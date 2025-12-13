import { IdentityFile, computeFingerprint, signMessage } from "./identity";
import { getServerUrl, getServerPassword } from "../utils/apiConfig";

async function postJson<T>(baseUrl: string, path: string, body: any): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

export async function performHandshake(id: IdentityFile, serverPassword?: string) {
  const serverUrl = getServerUrl();
  const { signatureB64, timestamp } = await signMessage(id, "handshake");

  const payload = {
    publicKey: id.publicKeyB64,
    fingerprint: computeFingerprint(id),
    displayName: id.displayName ?? null,
    serverPassword: serverPassword || null,
    signature: signatureB64,
    timestamp,
  };

  return postJson<{
    user: { id: number; username?: string | null; displayName: string | null; fingerprint: string };
    access: { passwordRequired: boolean };
  }>(serverUrl, "/api/auth/handshake", payload);
}

export async function buildIdentityHeaders(): Promise<Headers> {
  const headers = new Headers();
  const storedPassword = getServerPassword();
  const rawIdentity = localStorage.getItem("ct.identity.v1");
  if (!rawIdentity) return headers;

  const identity = JSON.parse(rawIdentity) as IdentityFile;
  const { signatureB64, timestamp } = await signMessage(identity, "handshake");

  headers.set("X-Server-Password", storedPassword || "");
  headers.set("X-Identity-PublicKey", identity.publicKeyB64);
  headers.set("X-Identity-Fingerprint", computeFingerprint(identity));
  headers.set("X-Identity-DisplayName", identity.displayName ?? "");
  headers.set("X-Identity-Signature", signatureB64);
  headers.set("X-Identity-Timestamp", String(timestamp));

  return headers;
}
