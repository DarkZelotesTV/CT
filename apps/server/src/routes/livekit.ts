import { Router } from 'express';
import { authenticateRequest, AuthRequest } from '../middleware/authMiddleware';
import { User } from '../models/User';
import { getVoiceProvider } from '../services/voiceProvider';

const router = Router();
const voiceProvider = getVoiceProvider();

// GET /api/livekit/token?room=channel_123
router.get('/token', authenticateRequest, async (req: AuthRequest, res) => {
  const roomName = req.query.room as string;
  const userId = String(req.user!.id);

  if (!voiceProvider.capabilities.tokens) {
    console.warn(`[Voice] /api/livekit/token called while provider "${voiceProvider.id}" does not issue tokens. TODO: remove this route once mediasoup signaling is wired.`);
    return res.status(410).json({ error: 'Voice token route ist für den aktuellen Provider deaktiviert' });
  }

  if (!roomName) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  try {
    // User laden, um Avatar und Anzeigenamen zu erhalten
    const user = await User.findByPk(req.user!.id).catch(() => null as any);
    const displayName = (user?.display_name || user?.username || `User ${userId}`) as string;
    const avatar = user?.avatar || null;

    const token = await voiceProvider.issueAccessToken({
      roomName,
      userId,
      displayName,
      avatar,
    });
    res.json({ token });
  } catch (err) {
    console.error("Voice Token Error:", err);
    res.status(500).json({ error: "Konnte Voice-Token nicht generieren" });
  }
});

export default router;
