import * as ed from "@noble/ed25519";
// NOTE: @noble/hashes v2 uses package "exports".
// In some installs, only the SHA-2 bundle is exported as a deep import (sha2.js),
// while a direct deep import like "@noble/hashes/sha512(.js)" may be blocked.
// SHA-512 is part of SHA-2, so import both from the SHA-2 entry.
import { sha256, sha512 } from "@noble/hashes/sha2.js";

// Ensure noble-ed25519 has a SHA-512 implementation in browser/electron renderer
ed.hashes.sha512 = sha512;
ed.hashes.sha512Async = async (msg: Uint8Array) => sha512(msg);

export type IdentityFile = {
  version: 1;
  publicKeyB64: string;   // 32 bytes
  privateKeyB64: string;  // 32 bytes seed
  createdAt: string;
  displayName?: string | null;
};

const STORAGE_KEY = "ct.identity.v1";

function u8ToB64(u8: Uint8Array): string {
  let s = "";
  for (const value of u8) s += String.fromCharCode(value);
  return btoa(s);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function formatFingerprint(hex64: string): string {
  // AA:BB:CC...
  return hex64.match(/.{1,2}/g)?.join(":") ?? hex64;
}

export function fingerprintFromPublicKey(publicKey: Uint8Array): string {
  const h = sha256(publicKey); // Uint8Array(32)
  return Array.from(h).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createIdentity(displayName?: string): Promise<IdentityFile> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const pub = await ed.getPublicKeyAsync(seed);
  const trimmedDisplayName = displayName?.trim();

  return {
    version: 1,
    publicKeyB64: u8ToB64(pub),
    privateKeyB64: u8ToB64(seed),
    createdAt: new Date().toISOString(),
    ...(trimmedDisplayName ? { displayName: trimmedDisplayName } : {}),
  };
}

export function loadIdentity(): IdentityFile | null {
  const stored = storage.get("identity");
  if (!stored) return null;
  const parsed = stored as IdentityFile;
  if (parsed?.version !== 1) return null;
  return parsed;
}

export function saveIdentity(id: IdentityFile) {
  storage.set("identity", id);
}

export function clearIdentity() {
  storage.remove("identity");
}

export function identityToKeys(id: IdentityFile) {
  const publicKey = b64ToU8(id.publicKeyB64);
  const seed = b64ToU8(id.privateKeyB64);
  return { publicKey, seed };
}

export async function signNonce(id: IdentityFile, nonceB64: string): Promise<string> {
  const { seed } = identityToKeys(id);
  const nonce = b64ToU8(nonceB64);
  const sig = await ed.signAsync(nonce, seed);
  return u8ToB64(sig);
}

export async function signMessage(
  id: IdentityFile,
  _message: string
): Promise<{ signatureB64: string; timestamp: number }>
{
  const { seed } = identityToKeys(id);
  const timestamp = Date.now();
  // Server expects: "handshake:${timestamp}" (see server auth route)
  const data = new TextEncoder().encode(`handshake:${timestamp}`);
  const sig = await ed.signAsync(data, seed);
  return { signatureB64: u8ToB64(sig), timestamp };
}

export function computeFingerprint(id: IdentityFile): string {
  const { publicKey } = identityToKeys(id);
  return fingerprintFromPublicKey(publicKey);
}
import { storage } from "../shared/config/storage";
