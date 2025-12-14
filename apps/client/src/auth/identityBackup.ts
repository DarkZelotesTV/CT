import { IdentityFile } from "./identity";

export type EncryptedBackupV1 = {
  kind: "clover-identity-backup";
  version: 1;
  encrypted: true;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64FromBytes(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<EncryptedBackupV1> {
  const iterations = 150_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return {
    kind: "clover-identity-backup",
    version: 1,
    encrypted: true,
    kdf: "PBKDF2-SHA256",
    iterations,
    saltB64: b64FromBytes(salt),
    ivB64: b64FromBytes(iv),
    ciphertextB64: b64FromBytes(new Uint8Array(ct)),
  };
}

export async function decryptBackup(backup: EncryptedBackupV1, passphrase: string): Promise<string> {
  const salt = bytesFromB64(backup.saltB64);
  const iv = bytesFromB64(backup.ivB64);
  const ct = bytesFromB64(backup.ciphertextB64);
  const iterations = Number(backup.iterations) || 150_000;
  const key = await deriveAesKey(passphrase, salt, iterations);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

export function getBackupFilename(encrypted: boolean) {
  return encrypted ? "clover-identity.backup.encrypted.json" : "clover-identity.cloverid.json";
}

export async function parseIdentityBackup(text: string, askPassphrase?: () => string | null): Promise<IdentityFile> {
  const parsedAny: any = JSON.parse(text);
  let parsed: any = parsedAny;

  if (parsedAny?.kind === "clover-identity-backup" && parsedAny?.encrypted) {
    const pass = (askPassphrase?.() ?? "").trim();
    if (!pass) throw new Error("Passphrase fehlt");
    const decrypted = await decryptBackup(parsedAny, pass);
    parsed = JSON.parse(decrypted);
  }

  if (!parsed?.publicKeyB64 || !parsed?.privateKeyB64) throw new Error("Ungültige Identity-Datei");
  return parsed as IdentityFile;
}

export async function buildBackupPayload(identity: IdentityFile, passphrase?: string) {
  if (!passphrase?.trim()) return identity;
  return encryptBackup(JSON.stringify(identity), passphrase.trim());
}
