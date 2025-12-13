import * as ed from '@noble/ed25519';
import crypto from 'crypto';
import { User } from '../models/User';

// noble braucht sha512 (Node liefert das über crypto)
ed.hashes.sha512 = (msg: Uint8Array) => new Uint8Array(crypto.createHash('sha512').update(msg).digest());
ed.hashes.sha512Async = async (msg: Uint8Array) => new Uint8Array(crypto.createHash('sha512').update(msg).digest());

function b64ToBuf(s: string) {
  return Buffer.from(s, 'base64');
}

function fingerprintFromPubKey(pubKey: Buffer) {
  return crypto.createHash('sha256').update(pubKey).digest('hex');
}

function normalizeDisplayName(display?: any) {
  if (typeof display !== 'string') return null;
  const trimmed = display.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 64);
}

function usernameFromDisplay(fp: string, display: string | null) {
  if (!display) return `user_${fp.slice(0, 6)}`;
  return `${display}#${fp.slice(0, 4)}`;
}

export type IdentityPayload = {
  fingerprint?: string;
  publicKeyB64?: string;
  displayName?: string | null;
  serverPassword?: string | null;
  signatureB64?: string | null;
  timestamp?: number | null;
};

function loadWhitelist() {
  return (process.env.SERVER_FINGERPRINT_WHITELIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateServerPassword(payload: IdentityPayload) {
  const configuredPassword = process.env.SERVER_PASSWORD;
  const whitelist = loadWhitelist();
  const fingerprint = payload.fingerprint;

  const allowedByPassword = !configuredPassword || payload.serverPassword === configuredPassword;
  const allowedByWhitelist = fingerprint && whitelist.includes(fingerprint);

  if (!allowedByPassword && !allowedByWhitelist) {
    const err: any = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
}

export async function verifyIdentitySignature(payload: IdentityPayload) {
  if (!payload.signatureB64) return;
  if (!payload.publicKeyB64) {
    const err: any = new Error('publicKey required for signature verification');
    err.status = 400;
    throw err;
  }

  const ts = payload.timestamp;
  if (!ts || Math.abs(Date.now() - ts) > 2 * 60 * 1000) {
    const err: any = new Error('signature timestamp expired');
    err.status = 401;
    throw err;
  }

  const message = Buffer.from(`handshake:${ts}`);
  const sig = b64ToBuf(payload.signatureB64);
  const pub = b64ToBuf(payload.publicKeyB64);

  const ok = await ed.verifyAsync(sig, message, pub);
  if (!ok) {
    const err: any = new Error('invalid signature');
    err.status = 401;
    throw err;
  }
}

export async function resolveUserFromIdentity(payload: IdentityPayload) {
  validateServerPassword(payload);

  const publicKeyB64 = payload.publicKeyB64;
  if (!publicKeyB64) {
    const err: any = new Error('publicKey missing');
    err.status = 400;
    throw err;
  }

  const pkBuf = b64ToBuf(publicKeyB64);
  if (pkBuf.length !== 32) {
    const err: any = new Error('publicKey invalid');
    err.status = 400;
    throw err;
  }

  const fingerprint = payload.fingerprint ?? fingerprintFromPubKey(pkBuf);
  if (!fingerprint) {
    const err: any = new Error('fingerprint missing');
    err.status = 400;
    throw err;
  }

  const expectedFp = fingerprintFromPubKey(pkBuf);
  if (fingerprint !== expectedFp) {
    const err: any = new Error('fingerprint does not match public key');
    err.status = 400;
    throw err;
  }

  await verifyIdentitySignature(payload);

  let user = await User.findOne({ where: { identity_fingerprint: fingerprint } });

  const normalizedDisplay = normalizeDisplayName(payload.displayName ?? null);

  if (!user) {
    user = await User.create({
      username: usernameFromDisplay(fingerprint, normalizedDisplay),
      display_name: normalizedDisplay,
      public_key: publicKeyB64,
      identity_fingerprint: fingerprint,
      status: 'offline',
    } as any);
  } else {
    let shouldSave = false;
    if (normalizedDisplay && user.display_name !== normalizedDisplay) {
      user.display_name = normalizedDisplay;
      user.username = usernameFromDisplay(fingerprint, normalizedDisplay);
      shouldSave = true;
    }
    if (!user.public_key) {
      user.public_key = publicKeyB64;
      shouldSave = true;
    }
    if (shouldSave) await user.save();
  }

  return { user, fingerprint, publicKeyB64 } as const;
}
