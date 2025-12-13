import { Router } from 'express';
import { Server, Channel, Message, User, ServerMember, Category } from '../models';
import { authenticateRequest, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// ==========================================
// SERVER ROUTES
// ==========================================

// 1. Alle Server laden (MVP: Alle existierenden)
router.get('/servers', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    // Später: Nur Server laden, wo User Mitglied ist via ServerMember
    const servers = await Server.findAll();
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Server" });
  }
});

// 2. Server erstellen
router.post('/servers', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const server = await Server.create({
      name,
      owner_id: req.user!.id,
      icon_url: `https://ui-avatars.com/api/?name=${name}&background=random`
    });

    // Owner automatisch als Mitglied hinzufügen
    await ServerMember.create({ server_id: server.id, user_id: req.user!.id });

    // Standard-Kanäle erstellen
    await Channel.create({ name: 'allgemein', type: 'text', server_id: server.id });
    await Channel.create({ name: 'Lobby', type: 'voice', server_id: server.id });

    res.json(server);
  } catch (err) {
    res.status(500).json({ error: "Konnte Server nicht erstellen" });
  }
});

// 3. Server beitreten
router.post('/servers/join', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { serverId } = req.body;
    const userId = req.user!.id;

    const server = await Server.findByPk(serverId);
    if (!server) return res.status(404).json({ error: "Server nicht gefunden" });

    const existing = await ServerMember.findOne({ where: { server_id: serverId, user_id: userId } });
    if (existing) return res.status(400).json({ error: "Du bist bereits Mitglied!" });

    await ServerMember.create({ server_id: serverId, user_id: userId });

    res.json({ message: "Erfolgreich beigetreten", server });
  } catch (err) {
    res.status(500).json({ error: "Konnte Server nicht beitreten" });
  }
});

// ==========================================
// STRUKTUR & CHANNELS ROUTES
// ==========================================

// 4. Komplette Server-Struktur laden (Kategorien + Kanäle)
router.get('/servers/:serverId/structure', authenticateRequest, async (req, res) => {
  try {
    const { serverId } = req.params;

    // A) Kategorien laden (inkl. ihrer Kanäle)
    const categories = await Category.findAll({
      where: { server_id: serverId },
      order: [['position', 'ASC']],
      include: [{
        model: Channel,
        as: 'channels',
        order: [['position', 'ASC']] // Kanäle innerhalb der Kategorie sortieren
      }]
    });

    // B) Kanäle ohne Kategorie laden (Uncategorized)
    const uncategorized = await Channel.findAll({
      where: { server_id: serverId, category_id: null },
      order: [['position', 'ASC']]
    });

    res.json({ categories, uncategorized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Laden der Struktur" });
  }
});

// 5. Kanal erstellen (Nur Owner)
router.post('/servers/:serverId/channels', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name, type, categoryId, customIcon } = req.body;
    const serverId = req.params.serverId;
    const userId = req.user!.id;

    // Rechte prüfen
    const server = await Server.findByPk(serverId);
    if (!server) return res.status(404).json({ error: "Server nicht gefunden" });
    
    if (server.owner_id !== userId) {
      return res.status(403).json({ error: "Nur der Besitzer darf Kanäle erstellen" });
    }

    const channel = await Channel.create({
      name,
      type,
      server_id: Number(serverId),
      category_id: categoryId || null,
      custom_icon: customIcon || null
    });

    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: "Kanal konnte nicht erstellt werden" });
  }
});

// 6. Kategorie erstellen (Nur Owner)
router.post('/servers/:serverId/categories', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const serverId = req.params.serverId;
    
    const server = await Server.findByPk(serverId);
    if (server?.owner_id !== req.user!.id) {
        return res.status(403).json({ error: "Keine Rechte" });
    }

    const category = await Category.create({
      name,
      server_id: Number(serverId),
      position: 999 // Ans Ende
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Kategorie Fehler" });
  }
});

// ==========================================
// MEMBER & MESSAGES ROUTES
// ==========================================

// 7. Mitgliederliste laden
router.get('/servers/:serverId/members', authenticateRequest, async (req, res) => {
  try {
    const { serverId } = req.params;
    const members = await ServerMember.findAll({
      where: { server_id: serverId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'avatar_url', 'status']
      }]
    });

    // Daten bereinigen
    const cleanMembers = members.map((m: any) => ({
      userId: m.user.id,
      username: m.user.username,
      avatarUrl: m.user.avatar_url,
      status: m.user.status,
      joinedAt: m.createdAt
    }));

    res.json(cleanMembers);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
  }
});

// 8. Nachrichten laden (History)
router.get('/channels/:channelId/messages', authenticateRequest, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { channel_id: req.params.channelId },
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar_url', 'id'] }],
      order: [['createdAt', 'ASC']],
      limit: 50
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Nachrichten" });
  }
});

// CHANNEL CONTENT UPDATE (Für Web-Channels)
router.put('/channels/:channelId/content', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;
    const channelId = req.params.channelId;
    const userId = req.user!.id;

    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: "Kanal nicht gefunden" });

    // Check: Ist User der Owner? (Später: Admin Rolle)
    const server = await Server.findByPk(channel.server_id);
    if (server?.owner_id !== userId) {
        return res.status(403).json({ error: "Nur der Owner darf Webseiten bearbeiten" });
    }

    // Speichern
    channel.content = content;
    await channel.save();

    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: "Konnte Inhalt nicht speichern" });
  }
});

export default router;