import { Router } from 'express';
import { Op } from 'sequelize';
import { User, Friendship } from '../models';
import { authenticateRequest, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Alle Freunde laden
router.get('/friends', authenticateRequest, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const friends = await Friendship.findAll({
      where: {
        [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
        status: 'accepted'
      }
    });
    
    // Die IDs der Freunde sammeln
    const friendIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    
    const users = await User.findAll({
      where: { id: friendIds },
      attributes: ['id', 'username', 'avatar_url', 'status'] // status kommt aus dem User-Modell (Online/Offline)
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Freunde" });
  }
});

// Ausstehende Anfragen laden (eingehend & ausgehend)
router.get('/friends/pending', authenticateRequest, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const pendingRequests = await Friendship.findAll({
      where: {
        [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
        status: 'pending'
      }
    });

    const relatedUserIds = pendingRequests.map(req => req.requester_id === userId ? req.addressee_id : req.requester_id);
    const users = await User.findAll({
      where: { id: relatedUserIds },
      attributes: ['id', 'username', 'avatar_url', 'status']
    });

    const usersMap = new Map(users.map(u => [u.id, u]));

    const response = pendingRequests.map(req => {
      const otherUser = usersMap.get(req.requester_id === userId ? req.addressee_id : req.requester_id);
      return {
        id: req.id,
        direction: req.addressee_id === userId ? 'incoming' : 'outgoing',
        user: otherUser
      };
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der ausstehenden Anfragen" });
  }
});

// Blockierte Nutzer laden
router.get('/friends/blocked', authenticateRequest, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const blockedRelations = await Friendship.findAll({
      where: {
        [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
        status: 'blocked'
      }
    });

    const relatedUserIds = blockedRelations.map(rel => rel.requester_id === userId ? rel.addressee_id : rel.requester_id);
    const users = await User.findAll({
      where: { id: relatedUserIds },
      attributes: ['id', 'username', 'avatar_url', 'status']
    });

    const usersMap = new Map(users.map(u => [u.id, u]));

    const response = blockedRelations.map(rel => {
      const otherUser = usersMap.get(rel.requester_id === userId ? rel.addressee_id : rel.requester_id);
      return {
        id: rel.id,
        blockedByMe: rel.requester_id === userId,
        user: otherUser
      };
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der blockierten Nutzer" });
  }
});

// Freundschaftsanfrage annehmen
router.post('/friends/:id/accept', authenticateRequest, async (req: AuthRequest, res) => {
  const friendshipId = Number(req.params.id);
  const userId = req.user!.id;

  try {
    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    if (friendship.addressee_id !== userId) return res.status(403).json({ error: "Keine Berechtigung" });
    if (friendship.status !== 'pending') return res.status(400).json({ error: "Anfrage ist nicht ausstehend" });

    friendship.status = 'accepted';
    await friendship.save();

    res.json({ message: "Freundschaftsanfrage angenommen" });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Annehmen der Anfrage" });
  }
});

// Freundschaftsanfrage ablehnen
router.post('/friends/:id/decline', authenticateRequest, async (req: AuthRequest, res) => {
  const friendshipId = Number(req.params.id);
  const userId = req.user!.id;

  try {
    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    if (friendship.addressee_id !== userId) return res.status(403).json({ error: "Keine Berechtigung" });
    if (friendship.status !== 'pending') return res.status(400).json({ error: "Anfrage ist nicht ausstehend" });

    await friendship.destroy();
    res.json({ message: "Freundschaftsanfrage abgelehnt" });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Ablehnen der Anfrage" });
  }
});

// Freundschaft blockieren
router.post('/friends/:id/block', authenticateRequest, async (req: AuthRequest, res) => {
  const friendshipId = Number(req.params.id);
  const userId = req.user!.id;

  try {
    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: "Freundschaft nicht gefunden" });
    if (![friendship.requester_id, friendship.addressee_id].includes(userId)) return res.status(403).json({ error: "Keine Berechtigung" });

    const otherUserId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;

    friendship.status = 'blocked';
    // Merken, wer blockiert hat
    friendship.requester_id = userId;
    friendship.addressee_id = otherUserId;
    await friendship.save();

    res.json({ message: "Nutzer blockiert" });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Blockieren" });
  }
});

// Freundschaftsanfrage senden
router.post('/friends/request', authenticateRequest, async (req: AuthRequest, res) => {
  const { username } = req.body;
  const requesterId = req.user!.id;

  try {
    const target = await User.findOne({ where: { username } });
    if (!target) return res.status(404).json({ error: "Nutzer nicht gefunden" });
    if (target.id === requesterId) return res.status(400).json({ error: "Du kannst dich nicht selbst adden" });

    // Check ob schon existiert
    const existing = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requester_id: requesterId, addressee_id: target.id },
          { requester_id: target.id, addressee_id: requesterId }
        ]
      }
    });

    if (existing) return res.status(400).json({ error: "Anfrage existiert bereits oder ihr seid Freunde" });

    await Friendship.create({
      requester_id: requesterId,
      addressee_id: target.id,
      status: 'pending'
    });

    res.json({ message: "Anfrage gesendet" });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Senden" });
  }
});

export default router;