import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // <--- WICHTIG: Import hinzugefügt
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
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

const PORT = Number(process.env.PORT || 3001);
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || process.env.HTTPS_CERT_PATH;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || process.env.HTTPS_KEY_PATH;
const configuredCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultCorsOrigins = [
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedHttpOrigins = configuredCorsOrigins.length ? configuredCorsOrigins : defaultCorsOrigins;
const allowedSocketOrigins = Array.from(
  new Set([
    ...allowedHttpOrigins,
    ...allowedHttpOrigins
      .filter((origin) => origin.startsWith('http://') || origin.startsWith('https://'))
      .map((origin) => origin.replace(/^http/, 'ws')),
  ]),
);

const allowOrigin = (origin: string | undefined, allowed: string[]) => {
  if (!origin || allowed.length === 0) return true;
  return allowed.some((allowedOrigin) => origin === allowedOrigin);
};

const resolvePathIfExists = (maybePath?: string | null) => {
  if (!maybePath) return null;
  const resolved = path.resolve(maybePath);
  if (!fs.existsSync(resolved)) {
    console.warn(`⚠️ TLS asset not found at ${resolved}`);
    return null;
  }
  return resolved;
};

type TlsCredentials = {
  key: Buffer;
  cert: Buffer;
  keyPath: string;
  certPath: string;
};

const loadTlsCredentials = (): TlsCredentials | null => {
  const resolvedCertPath = resolvePathIfExists(TLS_CERT_PATH);
  const resolvedKeyPath = resolvePathIfExists(TLS_KEY_PATH);

  if (resolvedCertPath && resolvedKeyPath) {
    try {
      return {
        cert: fs.readFileSync(resolvedCertPath),
        key: fs.readFileSync(resolvedKeyPath),
        certPath: resolvedCertPath,
        keyPath: resolvedKeyPath,
      };
    } catch (err) {
      console.warn('⚠️ Unable to read TLS credentials. Falling back to HTTP.', err);
      return null;
    }
  }

  if (TLS_CERT_PATH || TLS_KEY_PATH) {
    console.warn('⚠️ TLS configuration incomplete. Provide both TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS.');
  } else {
    console.warn('ℹ️ No TLS certificate/key configured. Set TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS.');
  }

  return null;
};

const app = express();
const tlsCredentials = loadTlsCredentials();
const httpServer = tlsCredentials
  ? createHttpsServer({ key: tlsCredentials.key, cert: tlsCredentials.cert }, app)
  : createHttpServer(app);
const serverProtocol = tlsCredentials ? 'https' : 'http';
const websocketProtocol = tlsCredentials ? 'wss' : 'ws';

if (tlsCredentials) {
  console.log('🔒 TLS enabled. Using HTTPS server.');
  console.log(`   - Certificate: ${tlsCredentials.certPath}`);
  console.log(`   - Key:         ${tlsCredentials.keyPath}`);
} else {
  console.warn('⚠️ Running without TLS. HTTPS/WebSocket secure endpoints will not be available.');
}
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Erlaubt Skripte und Styles (oft nötig für Dev-Tools/Vite)
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:", "https:", "blob:"],
        'connect-src': [
          "'self'",
          `${serverProtocol}:`,
          `${websocketProtocol}:`,
          ...allowedHttpOrigins,
          ...allowedSocketOrigins,
        ],
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
  origin: (origin, callback) => {
    if (allowOrigin(origin, allowedHttpOrigins)) {
      return callback(null, true);
    }
    console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
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
    origin: (origin, callback) => {
      if (allowOrigin(origin, allowedSocketOrigins)) {
        return callback(null, true);
      }
      console.warn(`🚫 Blocked Socket.IO connection from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
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
sequelize.sync({ alter: true }).then(() => {
  console.log("------------------------------------------------");
  console.log("✅ Datenbank verbunden & synchronisiert!");
  console.log("------------------------------------------------");

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Server] Läuft auf:`);
    console.log(`   - Local:   ${serverProtocol}://localhost:${PORT}`);
    console.log(`   - Network: ${serverProtocol}://127.0.0.1:${PORT}`);
    console.log(`   - Socket:  ${websocketProtocol}://localhost:${PORT}`);
    if (!tlsCredentials) {
      console.warn('⚠️ TLS assets not provided. HTTP/WebSocket insecure endpoints are active. Configure TLS_CERT_PATH and TLS_KEY_PATH for HTTPS/WSS.');
    }
    console.log("------------------------------------------------");
  });
}).catch(err => {
  console.error("❌ Datenbank Fehler:", err);
});
