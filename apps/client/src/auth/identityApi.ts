import { IdentityFile, signNonce } from "./identity";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

/**
 * TS3-style identity login:
 * 1) /api/auth/challenge  -> nonce
 * 2) sign nonce with local private key
 * 3) /api/auth/verify     -> app JWT + user payload
 */
export async function identityLogin(id: IdentityFile) {
  const challenge = await postJson<{ nonce: string; expiresIn: number }>(
    "/api/auth/challenge",
    { publicKey: id.publicKeyB64 }
  );

  const signature = await signNonce(id, challenge.nonce);

  const verified = await postJson<{
    token: string;
    user: { id: number; username?: string | null; displayName: string | null; fingerprint: string };
  }>("/api/auth/verify", {
    publicKey: id.publicKeyB64,
    nonce: challenge.nonce,
    signature,
    displayName: id.displayName ?? null,
  });

  return verified;
}
