import { IdentityFile, computeFingerprint, signMessage } from "./identity";
import { getServerUrl, getServerPassword } from "../utils/apiConfig";

// ==========================================
// 1) HANDSHAKE LOGIK
// ==========================================

interface HandshakeResponse {
  user: { id: number; username?: string | null; displayName: string | null; fingerprint: string };
  access: { passwordRequired: boolean };
  config?: { livekitUrl?: string };
}

async function postJson<T>(baseUrl: string, path: string, body: any): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${msg}`);
  }

  return (await res.json()) as T;
}

export async function performHandshake(id: IdentityFile, serverPassword?: string) {
  const baseUrl = getServerUrl();

  // FIX: computeFingerprint erwartet IdentityFile (nicht publicKey string)
  const fingerprint = computeFingerprint(id);

  const payload = {
    publicKey: id.publicKeyB64,
    fingerprint,
    signature: signMessage(id, fingerprint),
    serverPassword: serverPassword || null,
  };

  const response = await postJson<HandshakeResponse>(baseUrl, "/api/auth/handshake", payload);

  // Optional: LiveKit URL vom Server übernehmen
  if (response.config?.livekitUrl) {
    console.log("[Auth] Received Voice Config from Server:", response.config.livekitUrl);
    localStorage.setItem("clover_livekit_url", response.config.livekitUrl);
  } else {
    localStorage.removeItem("clover_livekit_url");
  }

  return response;
}

export function buildHandshakeHeaders(identity: IdentityFile): Headers {
  const headers = new Headers();
  const storedPassword = getServerPassword();

  headers.set("X-Server-Password", storedPassword || "");
  headers.set("X-Identity-PublicKey", identity.publicKeyB64);

  return headers;
}

// ==========================================
// 2) BACKUP LOGIK
// ==========================================

// WebCrypto expects BufferSource values backed by a plain ArrayBuffer.
// With newer TS DOM typings, Uint8Array can be generic over ArrayBufferLike (incl. SharedArrayBuffer).
// This helper normalizes to a standalone ArrayBuffer.
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Uint8Array.slice() creates a copy backed by a *new ArrayBuffer*
  return u8.slice().buffer as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder();

  // FIX: importKey expects BufferSource -> give it a plain ArrayBuffer
  const passphraseBytes = toArrayBuffer(enc.encode(passphrase));

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // FIX: PBKDF2Params.salt expects BufferSource -> give it a plain ArrayBuffer
  const saltBytes = toArrayBuffer(salt);

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function buffToB64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...u8));
}

function b64ToBuff(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function getBackupFilename(isEncrypted: boolean): string {
  const date = new Date().toISOString().split("T")[0];
  return `clover-identity-${date}${isEncrypted ? ".enc" : ""}.json`;
}

// (NEU) Der Name, den deine Modals importieren:
export async function buildBackupPayload(identity: IdentityFile, passphrase?: string): Promise<any> {
  return createIdentityBackupPayload(identity, passphrase);
}

// (Behalten) eigentliche Implementierung
export async function createIdentityBackupPayload(identity: IdentityFile, passphrase?: string): Promise<any> {
  // Fall 1: Keine Passphrase -> unverschlüsselt speichern
  if (!passphrase) {
    return {
      version: 1,
      encrypted: false,
      data: identity,
    };
  }

  // Fall 2: Passphrase vorhanden -> Verschlüsseln
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const dataEncoded = enc.encode(JSON.stringify(identity));

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(dataEncoded)
  );

  return {
    version: 1,
    encrypted: true,
    salt: buffToB64(salt),
    iv: buffToB64(iv),
    ciphertext: buffToB64(encrypted),
  };
}

export async function parseIdentityBackup(
  jsonString: string,
  requestPassphrase: () => string | Promise<string>
): Promise<IdentityFile> {
  const payload = JSON.parse(jsonString);

  if (!payload.encrypted) {
    if (!payload.data || !payload.data.publicKeyB64) {
      throw new Error("Ungültiges Backup-Format.");
    }
    return payload.data as IdentityFile;
  }

  const passphrase = await requestPassphrase();
  if (!passphrase) throw new Error("Passphrase erforderlich.");

  try {
    const salt = b64ToBuff(payload.salt);
    const iv = b64ToBuff(payload.iv);
    const ciphertext = b64ToBuff(payload.ciphertext);

    const key = await deriveKey(passphrase, salt);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decrypted);
    return JSON.parse(jsonStr) as IdentityFile;
  } catch {
    throw new Error("Entschlüsselung fehlgeschlagen. Falsches Passwort?");
  }
}
