import { Router } from "express";
import { resolveUserFromIdentity, validateServerPassword } from "../utils/identityAuth";

const router = Router();

router.get("/ping", (_req, res) => res.json({ ok: true }));

router.post("/handshake", async (req, res) => {
  try {
    const { user, fingerprint } = await resolveUserFromIdentity({
      fingerprint: req.body?.fingerprint,
      publicKeyB64: req.body?.publicKey,
      displayName: req.body?.displayName,
      serverPassword: req.body?.serverPassword,
      signatureB64: req.body?.signature,
      timestamp: req.body?.timestamp ? Number(req.body.timestamp) : null,
    });

    // NEU: LiveKit URL aus der Server-Konfiguration lesen
    // Wir schauen nach LIVEKIT_PUBLIC_URL oder Fallback VITE_LIVEKIT_URL
    const livekitUrl = process.env.LIVEKIT_PUBLIC_URL || process.env.VITE_LIVEKIT_URL || "";

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name ?? null,
        fingerprint,
      },
      access: {
        passwordRequired: Boolean(process.env.SERVER_PASSWORD),
      },
      // NEU: Config-Objekt an den Client senden
      config: {
        livekitUrl: livekitUrl
      }
    });
  } catch (err: any) {
    const status = err?.status || 401;
    res.status(status).json({ error: err?.message || "unauthorized" });
  }
});

router.post("/authorize", (req, res) => {
  try {
    validateServerPassword({
      fingerprint: req.body?.fingerprint,
      serverPassword: req.body?.serverPassword,
    });
    res.json({ ok: true });
  } catch (err: any) {
    const status = err?.status || 401;
    res.status(status).json({ error: err?.message || "unauthorized" });
  }
});

export default router;