import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authenticateRequest, AuthRequest } from '../middleware/authMiddleware';
import { User } from '../models/User';

const router = Router();

// GET /api/livekit/token?room=channel_123
router.get('/token', authenticateRequest, async (req: AuthRequest, res) => {
  const roomName = req.query.room as string;
  const userId = String(req.user!.id);

  if (!roomName) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit API keys are missing' });
    }

    // User laden, um Avatar und Anzeigenamen zu erhalten
    const user = await User.findByPk(req.user!.id).catch(() => null as any);
    const displayName = (user?.display_name || user?.username || `User ${userId}`) as string;
    const avatar = user?.avatar || null;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      // Metadaten als JSON-String hinterlegen
      metadata: JSON.stringify({
        avatar,
        displayName
      })
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({ token });
  } catch (err) {
    console.error("LiveKit Token Error:", err);
    res.status(500).json({ error: "Konnte Voice-Token nicht generieren" });
  }
});

export default router;