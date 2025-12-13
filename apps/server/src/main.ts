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

// Models Importe (für Socket Logik)
import { Message, User } from './models';
import { resolveUserFromIdentity } from './utils/identityAuth';

const app = express();
const httpServer = createServer(app);

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

  if (numericUserId) {
     console.log(`User ${numericUserId} connected (Socket ID: ${socket.id})`);

     try {
       await User.update({ status: 'online' }, { where: { id: numericUserId } });
       socket.broadcast.emit('user_status_change', { userId: numericUserId, status: 'online' });
     } catch (err) {
       console.error("Fehler beim Setzen des Online-Status:", err);
     }
  }

  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
    console.log(`Socket ${socket.id} joined channel_${channelId}`);
  });

  socket.on('send_message', async (data) => {
    try {
        const senderId = numericUserId;
        if (!senderId) throw new Error('unauthorized');

        const msg = await Message.create({
            content: data.content,
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

  socket.on('disconnect', async () => {
    if (numericUserId) {
       console.log(`User ${numericUserId} disconnected`);

       try {
         await User.update({ status: 'offline' }, { where: { id: numericUserId } });
         socket.broadcast.emit('user_status_change', { userId: numericUserId, status: 'offline' });
       } catch (err) {
         console.error("Fehler beim Setzen des Offline-Status:", err);
       }
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
