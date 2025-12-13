import { getServerUrl, getServerPassword } from "../utils/apiConfig";
import { computeFingerprint, signMessage } from "../auth/identity";

/**
 * Authenticated fetch helper using identity headers instead of JWT.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const serverPassword = getServerPassword();
  const rawIdentity = localStorage.getItem("ct.identity.v1");

  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (serverPassword) headers.set("X-Server-Password", serverPassword);

  if (rawIdentity) {
    const identity = JSON.parse(rawIdentity);
    const { signatureB64, timestamp } = await signMessage(identity, "handshake");
    headers.set("X-Identity-PublicKey", identity.publicKeyB64);
    headers.set("X-Identity-Fingerprint", computeFingerprint(identity));
    headers.set("X-Identity-DisplayName", identity.displayName ?? "");
    headers.set("X-Identity-Signature", signatureB64);
    headers.set("X-Identity-Timestamp", String(timestamp));
  }

  const res = await fetch(`${getServerUrl()}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}
