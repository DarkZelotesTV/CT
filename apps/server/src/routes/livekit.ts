import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// GET /api/livekit/token?room=channel_123
router.get('/token', authenticateToken, async (req: AuthRequest, res) => {
  const roomName = req.query.room as string;
  const username = req.user!.username;
  const userId = String(req.user!.id);

  if (!roomName) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  try {
    // 1. Token erstellen
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userId,
        name: username,
      }
    );

    // 2. Rechte vergeben (User darf joinen, sprechen, publishen)
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true, // Darf Kamera/Mikro anmachen
      canSubscribe: true, // Darf andere hören
    });

    // 3. Token generieren (JWT String)
    const token = await at.toJwt();

    res.json({ token });
  } catch (err) {
    console.error("LiveKit Token Error:", err);
    res.status(500).json({ error: "Konnte Voice-Token nicht generieren" });
  }
});

export default router;