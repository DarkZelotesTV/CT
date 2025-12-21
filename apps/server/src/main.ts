import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // <--- WICHTIG: Import hinzugefügt
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sequelize } from './config/database';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from './utils/paths';

// Routen Importe
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import friendsRoutes from './routes/friends';
import livekitRoutes from './routes/livekit'; // WICHTIG: Sicherstellen, dass diese Datei existiert!
import {
  userChannelMemberships,
  registerUserSocket,
  removeUserFromAllChannels,
  removeUserFromChannel,
  unregisterUserSocket,
} from './realtime/registry';

// Models Importe (für Socket Logik)
import { User, ServerMember, MemberRole, Role } from './models';
import { resolveUserFromIdentity } from './utils/identityAuth';

const app = express();
const httpServer = createServer(app);
const HEARTBEAT_INTERVAL_MS = 15_000;
const OFFLINE_GRACE_MS = 30_000;
const offlineTimers = new Map<number, NodeJS.Timeout>();

const clearOfflineTimer = (userId: number) => {
  const existing = offlineTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    offlineTimers.delete(userId);
  }
};

const markUserOffline = async (userId: number) => {
  clearOfflineTimer(userId);

  removeUserFromAllChannels(userId);

  try {
    await User.update({ status: 'offline' }, { where: { id: userId } });
    io.emit('user_status_change', { userId, status: 'offline' });
  } catch (err) {
    console.error("Fehler beim Setzen des Offline-Status:", err);
  }
};

const scheduleOfflineCheck = (userId: number) => {
  clearOfflineTimer(userId);
  offlineTimers.set(userId, setTimeout(() => markUserOffline(userId), OFFLINE_GRACE_MS));
};

const sendPresenceSnapshot = async (socket: any) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username', 'avatar_url', 'status'] });
    socket.emit('presence_snapshot', { users });
  } catch (err) {
    console.error('Fehler beim Senden des Presence-Snapshots:', err);
  }
};

// ==========================================
// 1. CORS & MIDDLEWARE (Sicherheit lockern)
// ==========================================

// NEU: Helmet für Content Security Policy (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Erlaubt Skripte und Styles (oft nötig für Dev-Tools/Vite)
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:", "https:", "blob:"],
        'connect-src': ["'self'", "ws:", "wss:", "http:", "https:"], 
        // WICHTIG: Hier erlauben wir die Codenames-Seite im Iframe
        'frame-src': ["'self'", "https://codenames.game/"], 
      },
    },
    // Deaktiviert COEP, falls es Probleme beim Laden von Ressourcen gibt
    crossOriginEmbedderPolicy: false,
    // Erlaubt Laden von Ressourcen über Origins hinweg (hilfreich im Dev-Mode)
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(cors({
  origin: true, // Erlaubt automatisch jede anfragende Quelle (Vite/Electron)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true // Erlaubt Cookies/Authorization Header
}));

app.use(express.json());
const uploadRoot = UPLOADS_DIR;
fs.promises.mkdir(uploadRoot, { recursive: true }).catch(() => {});
app.use('/uploads', express.static(uploadRoot));

// ==========================================
// 2. SOCKET.IO SETUP
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Erlaubt Verbindungen von überall
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 3. API ROUTEN REGISTRIEREN
// ==========================================
app.use('/api/auth', authRoutes);       // Identity handshake
app.use('/api', dataRoutes);            // Server, Channels, Members
app.use('/api', friendsRoutes);
app.use('/api/livekit', livekitRoutes); // Voice/Video Tokens

// ==========================================
// 4. ECHTZEIT LOGIK (Socket.io)
// ==========================================

io.use(async (socket, next) => {
  try {
    const identity = (socket.handshake as any).auth || {};
    const { user, fingerprint } = await resolveUserFromIdentity({
      fingerprint: identity.fingerprint,
      publicKeyB64: identity.publicKey,
      displayName: identity.displayName,
      serverPassword: identity.serverPassword,
      signatureB64: identity.signature,
      timestamp: identity.timestamp ? Number(identity.timestamp) : null,
    });

    (socket.data as any).userId = user.id;
    (socket.data as any).fingerprint = fingerprint;
    next();
  } catch (err: any) {
    next(new Error(err?.message || 'unauthorized'));
  }
});

io.on('connection', async (socket) => {
  const userId = (socket.data as any).userId;
  const numericUserId = userId ? Number(userId) : null;
  (socket.data as any).joinedChannels = new Set<number>();
  (socket.data as any).heartbeatInterval = null;
  (socket.data as any).presenceSnapshotInterval = null;

  if (numericUserId) {
     console.log(`User ${numericUserId} connected (Socket ID: ${socket.id})`);

     try {
       clearOfflineTimer(numericUserId);
       await User.update({ status: 'online' }, { where: { id: numericUserId } });
       io.emit('user_status_change', { userId: numericUserId, status: 'online' });
       scheduleOfflineCheck(numericUserId);
       await sendPresenceSnapshot(socket);
       registerUserSocket(numericUserId, socket);
     } catch (err) {
       console.error("Fehler beim Setzen des Online-Status:", err);
     }

     (socket.data as any).heartbeatInterval = setInterval(() => {
       socket.emit('presence_ping');
     }, HEARTBEAT_INTERVAL_MS);

     (socket.data as any).presenceSnapshotInterval = setInterval(() => {
       sendPresenceSnapshot(socket);
     }, HEARTBEAT_INTERVAL_MS * 2);
  }

  socket.on('presence_ack', () => {
    if (!numericUserId) return;
    scheduleOfflineCheck(numericUserId);
  });

  socket.on('join_channel', async (channelId: number) => {
    if (!numericUserId) return;

    const joinedChannels: Set<number> = (socket.data as any).joinedChannels;
    const globalChannels = userChannelMemberships.get(numericUserId) || new Set<number>();
    for (const prevChannel of Array.from(joinedChannels)) {
      if (prevChannel !== channelId) {
        socket.leave(`channel_${prevChannel}`);
        removeUserFromChannel(prevChannel, numericUserId);
        joinedChannels.delete(prevChannel);
        globalChannels.delete(prevChannel);
      }
    }

    const room = `channel_${channelId}`;
    socket.join(room);
    joinedChannels.add(channelId);
    globalChannels.add(channelId);
    userChannelMemberships.set(numericUserId, globalChannels);

    console.log(`Socket ${socket.id} joined channel_${channelId}`);
  });

  socket.on('request_server_members', async (payload: { serverId?: number }) => {
    if (!payload?.serverId) return;

    try {
      const members = await ServerMember.findAll({
        where: { server_id: payload.serverId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar_url', 'status']
        }]
      });

      const assignments = await MemberRole.findAll({
        where: { server_id: payload.serverId },
        include: [{ model: Role, as: 'role' }]
      });

      const rolesByUser: Record<number, any[]> = {};
      assignments.forEach((a: any) => {
        rolesByUser[a.user_id] = rolesByUser[a.user_id] || [];
        if (a.role) rolesByUser[a.user_id].push(a.role);
      });

      const memberPayload = members.map((m: any) => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatar_url,
        status: m.user.status,
        joinedAt: m.createdAt,
        roles: rolesByUser[m.user.id] || [],
      }));

      socket.emit('server_members_snapshot', { serverId: payload.serverId, members: memberPayload });
    } catch (err) {
      console.error('Fehler beim Senden der Member Snapshot:', err);
    }
  });

  socket.on('leave_channel', (channelId: number) => {
    if (!numericUserId) return;

    const joinedChannels: Set<number> = (socket.data as any).joinedChannels;
    if (!joinedChannels.has(channelId)) return;

    socket.leave(`channel_${channelId}`);
    joinedChannels.delete(channelId);
    removeUserFromChannel(channelId, numericUserId);
  });

  socket.on('disconnect', async () => {
    if (numericUserId) {
       console.log(`User ${numericUserId} disconnected`);

       const joinedChannels: Set<number> = (socket.data as any).joinedChannels || new Set();
       for (const ch of Array.from(joinedChannels)) {
         socket.leave(`channel_${ch}`);
       }

       if ((socket.data as any).heartbeatInterval) {
         clearInterval((socket.data as any).heartbeatInterval);
       }

       if ((socket.data as any).presenceSnapshotInterval) {
         clearInterval((socket.data as any).presenceSnapshotInterval);
       }

       unregisterUserSocket(numericUserId, socket);
       scheduleOfflineCheck(numericUserId);
    }
  });
});

// ==========================================
// 5. SERVER STARTEN
// ==========================================
const PORT = 3001;

sequelize.sync({ alter: true }).then(() => {
  console.log("------------------------------------------------");
  console.log("✅ Datenbank verbunden & synchronisiert!");
  console.log("------------------------------------------------");

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Server] Läuft auf:`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://127.0.0.1:${PORT}`);
    console.log("------------------------------------------------");
  });
}).catch(err => {
  console.error("❌ Datenbank Fehler:", err);
});