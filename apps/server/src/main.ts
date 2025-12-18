import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sequelize } from './config/database';

// Routen Importe
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import friendsRoutes from './routes/friends';
import livekitRoutes from './routes/livekit'; // WICHTIG: Sicherstellen, dass diese Datei existiert!
import {
  channelPresence,
  channelPublicKeys,
  userChannelMemberships,
  emitToUser,
  registerUserSocket,
  removeUserFromAllChannels,
  removeUserFromChannel,
  setIoInstance,
  unregisterUserSocket,
} from './realtime/registry';

// Models Importe (für Socket Logik)
import { Message, User, ServerMember, MemberRole, Role, ServerBan } from './models';
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
app.use(cors({
  origin: true, // Erlaubt automatisch jede anfragende Quelle (Vite/Electron)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true // Erlaubt Cookies/Authorization Header
}));

app.use(express.json());

// ==========================================
// 2. SOCKET.IO SETUP
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Erlaubt Verbindungen von überall
    methods: ["GET", "POST"]
  }
});

setIoInstance(io);

// ==========================================
// 3. API ROUTEN REGISTRIEREN
// ==========================================
app.use('/api/auth', authRoutes);       // Identity handshake
app.use('/api', dataRoutes);            // Server, Channels, Messages, Members
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

    let channelUsers = channelPresence.get(channelId);
    if (!channelUsers) {
      channelUsers = new Set<number>();
      channelPresence.set(channelId, channelUsers);
    }

    let channelKeys = channelPublicKeys.get(channelId);
    if (!channelKeys) {
      channelKeys = new Map<number, string>();
      channelPublicKeys.set(channelId, channelKeys);
    }

    const wasAlreadyPresent = channelUsers.has(numericUserId);
    channelUsers.add(numericUserId);

    try {
      const user = await User.findByPk(numericUserId, {
        attributes: ['id', 'username', 'avatar_url', 'status'],
      });

      if (!wasAlreadyPresent && user) {
        io.to(room).emit('channel_presence_join', { channelId, user });
      }

      const activeUsers = await User.findAll({
        where: { id: Array.from(channelUsers) },
        attributes: ['id', 'username', 'avatar_url', 'status'],
      });

      socket.emit('channel_presence_snapshot', { channelId, users: activeUsers });
      socket.emit('channel_public_keys', { channelId, keys: Array.from(channelKeys.entries()).map(([id, publicKey]) => ({ userId: id, publicKey })) });
    } catch (err) {
      console.error('Fehler bei Channel-Presence:', err);
    }

    console.log(`Socket ${socket.id} joined channel_${channelId}`);
  });

  socket.on('publish_public_key', (payload: { channelId?: number; publicKey?: string }) => {
    if (!numericUserId) return;
    if (!payload?.channelId || typeof payload.publicKey !== 'string') return;

    const room = `channel_${payload.channelId}`;
    const channelKeys = channelPublicKeys.get(payload.channelId) || new Map<number, string>();
    channelKeys.set(numericUserId, payload.publicKey);
    channelPublicKeys.set(payload.channelId, channelKeys);

    socket.to(room).emit('channel_public_key', { channelId: payload.channelId, userId: numericUserId, publicKey: payload.publicKey });
  });

  socket.on('channel_key_share', (payload: { channelId?: number; toUserId?: number; encryptedKey?: string; iv?: string; senderPublicKey?: string }) => {
    if (!numericUserId) return;
    if (!payload?.channelId || typeof payload.toUserId !== 'number') return;
    if (typeof payload.encryptedKey !== 'string' || typeof payload.iv !== 'string' || typeof payload.senderPublicKey !== 'string') return;

    io.to(`channel_${payload.channelId}`).emit('channel_key_share', {
      channelId: payload.channelId,
      toUserId: payload.toUserId,
      fromUserId: numericUserId,
      encryptedKey: payload.encryptedKey,
      iv: payload.iv,
      senderPublicKey: payload.senderPublicKey,
    });
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

  socket.on('send_message', async (data) => {
    try {
        const senderId = numericUserId;
        if (!senderId) throw new Error('unauthorized');

        if (!data?.content || typeof data.content.ciphertext !== 'string' || typeof data.content.iv !== 'string') {
          throw new Error('invalid payload');
        }

        const msg = await Message.create({
            content: JSON.stringify({ ciphertext: data.content.ciphertext, iv: data.content.iv }),
            channel_id: data.channelId,
            user_id: senderId
        });

        const fullMsg = await Message.findByPk(msg.id, {
            include: [{ model: User, as: 'sender', attributes: ['username', 'avatar_url', 'id'] }]
        });

        io.to(`channel_${data.channelId}`).emit('receive_message', fullMsg);

    } catch (e) {
        console.error("Socket Message Error:", e);
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
