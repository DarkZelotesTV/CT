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
app.use('/api/auth', authRoutes);       // Login/Register
app.use('/api', dataRoutes);            // Server, Channels, Messages, Members
app.use('/api/livekit', livekitRoutes); // Voice/Video Tokens
app.use('/api', friendsRoutes);

// ==========================================
// 4. ECHTZEIT LOGIK (Socket.io)
// ==========================================
io.on('connection', async (socket) => {
  // Wir schauen, ob der Client eine userId beim Verbinden mitsendet
  // (Das müssen wir im Frontend noch einbauen!)
  const userId = socket.handshake.query.userId;
  const numericUserId = userId ? Number(userId) : null;

  if (numericUserId) {
     console.log(`User ${numericUserId} connected (Socket ID: ${socket.id})`);
     
     // A) Status in DB auf ONLINE setzen
     try {
       await User.update({ status: 'online' }, { where: { id: numericUserId } });
       
       // B) Allen anderen sagen: "Dieser User ist jetzt online"
       socket.broadcast.emit('user_status_change', { userId: numericUserId, status: 'online' });
     } catch (err) {
       console.error("Fehler beim Setzen des Online-Status:", err);
     }
  }

  // A) Channel beitreten (für Chat-Räume)
  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
    console.log(`Socket ${socket.id} joined channel_${channelId}`);
  });

  // B) Nachricht empfangen & speichern
  socket.on('send_message', async (data) => {
    // data erwartet: { content, channelId, userId }
    try {
        // 1. In DB speichern
        const msg = await Message.create({
            content: data.content,
            channel_id: data.channelId,
            user_id: data.userId
        });

        // 2. User Infos nachladen (damit Avatar/Name sofort angezeigt werden kann)
        const fullMsg = await Message.findByPk(msg.id, {
            include: [{ model: User, as: 'sender', attributes: ['username', 'avatar_url', 'id'] }]
        });

        // 3. An alle im Raum senden
        io.to(`channel_${data.channelId}`).emit('receive_message', fullMsg);
        
    } catch (e) {
        console.error("Socket Message Error:", e);
    }
  });

  // C) Disconnect (Offline gehen)
  socket.on('disconnect', async () => {
    if (numericUserId) {
       console.log(`User ${numericUserId} disconnected`);
       
       try {
         // Status in DB auf OFFLINE setzen
         await User.update({ status: 'offline' }, { where: { id: numericUserId } });
         
         // Allen sagen: "Dieser User ist jetzt offline"
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

// "alter: true" passt die Tabellenstruktur an, falls wir Models geändert haben
sequelize.sync({ alter: true }).then(() => {
  console.log("------------------------------------------------");
  console.log("✅ Datenbank verbunden & synchronisiert!");
  console.log("------------------------------------------------");
  
  // '0.0.0.0' bindet an alle Interfaces (löst IPv4/IPv6 Probleme)
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Server] Läuft auf:`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://127.0.0.1:${PORT}`);
    console.log("------------------------------------------------");
  });
}).catch(err => {
  console.error("❌ Datenbank Fehler:", err);
});