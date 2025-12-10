import { Router } from 'express';
import { Op } from 'sequelize';
import { User, Friendship } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Alle Freunde laden
router.get('/friends', authenticateToken, async (req: AuthRequest, res) => {
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

// Freundschaftsanfrage senden
router.post('/friends/request', authenticateToken, async (req: AuthRequest, res) => {
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