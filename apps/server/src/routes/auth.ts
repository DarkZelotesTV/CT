import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import * as ed from "@noble/ed25519";
import crypto from "crypto";

// noble braucht sha512 (Node liefert das über crypto)
ed.hashes.sha512 = (msg: Uint8Array) =>
  new Uint8Array(crypto.createHash("sha512").update(msg).digest());
ed.hashes.sha512Async = async (msg: Uint8Array) =>
  new Uint8Array(crypto.createHash("sha512").update(msg).digest());

// TODO: replace with Redis in production
const challenges = new Map<string, { nonce: Buffer; exp: number }>();

function b64ToBuf(s: string) {
  return Buffer.from(s, "base64");
}
function bufToB64(b: Buffer) {
  return b.toString("base64");
}

function fingerprintFromPubKey(pubKey: Buffer) {
  return crypto.createHash("sha256").update(pubKey).digest("hex"); // 64 hex chars
}

function safeNameFromFingerprint(fp: string) {
  return `user_${fp.slice(0, 6)}`;
}

// Keep usernames stable+unique even if MySQL still has UNIQUE(username)
function usernameFromDisplay(fp: string, display: string | null) {
  if (!display) return safeNameFromFingerprint(fp);
  return `${display}#${fp.slice(0, 4)}`;
}

const router = Router();

/**
 * POST /api/auth/challenge
 * body: { publicKey: base64(32) }
 * response: { nonce: base64(32), expiresIn: 60 }
 */
router.post("/challenge", async (req, res) => {
  const { publicKey } = req.body ?? {};
  if (!publicKey) return res.status(400).json({ error: "publicKey missing" });

  const pk = b64ToBuf(publicKey);
  if (pk.length !== 32) return res.status(400).json({ error: "publicKey must be 32 bytes (base64)" });

  const nonce = crypto.randomBytes(32);
  const fp = fingerprintFromPubKey(pk);

  challenges.set(fp, { nonce, exp: Date.now() + 60_000 });

  res.json({ nonce: bufToB64(nonce), expiresIn: 60 });
});

/**
 * POST /api/auth/verify
 * body: { publicKey, nonce, signature, displayName? }
 * response: { token, user }
 */
router.post("/verify", async (req, res) => {
  const { publicKey, nonce, signature, displayName } = req.body ?? {};
  if (!publicKey || !nonce || !signature) return res.status(400).json({ error: "missing fields" });

  const pk = b64ToBuf(publicKey);
  const n = b64ToBuf(nonce);
  const sig = b64ToBuf(signature);

  if (pk.length !== 32) return res.status(400).json({ error: "publicKey invalid" });
  if (n.length !== 32) return res.status(400).json({ error: "nonce invalid" });
  if (sig.length !== 64) return res.status(400).json({ error: "signature invalid" });

  const fp = fingerprintFromPubKey(pk);
  const ch = challenges.get(fp);
  if (!ch) return res.status(401).json({ error: "no challenge" });
  if (Date.now() > ch.exp) {
    challenges.delete(fp);
    return res.status(401).json({ error: "challenge expired" });
  }

  // Nonce must match exactly
  if (!crypto.timingSafeEqual(ch.nonce, n)) return res.status(401).json({ error: "nonce mismatch" });

  // one-time challenge
  challenges.delete(fp);

  // ✅ FIX: message must be Uint8Array/Buffer, not the base64 string "nonce"
  const ok = await ed.verifyAsync(sig, n, pk);
  if (!ok) return res.status(401).json({ error: "bad signature" });

  const normalizedDisplay =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim().slice(0, 64)
      : null;

  let user = await User.findOne({ where: { identity_fingerprint: fp } });

  if (!user) {
    user = await User.create({
      username: usernameFromDisplay(fp, normalizedDisplay),
      display_name: normalizedDisplay,
      public_key: publicKey,
      identity_fingerprint: fp,
      status: "offline",
    } as any);
  } else {
    // Update display name if provided
    if (normalizedDisplay && user.display_name !== normalizedDisplay) {
      user.display_name = normalizedDisplay;
      user.username = usernameFromDisplay(fp, normalizedDisplay); // keeps stable+unique
      await user.save();
    }
    // Backfill public_key if missing
    if (!user.public_key) {
      user.public_key = publicKey;
      await user.save();
    }
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: "JWT_SECRET missing on server" });

  const token = jwt.sign({ sub: String(user.id), fp, pk: publicKey }, secret, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username ?? usernameFromDisplay(fp, user.display_name ?? null),
      displayName: user.display_name ?? null,
      fingerprint: fp,
    },
  });
});

export default router;
