import { getServerUrl, getServerPassword } from "../utils/apiConfig";
import { computeFingerprint, signMessage } from "../auth/identity";
import { storage } from "../shared/config/storage";

export type ApiFetchInit = RequestInit & {
  /** Override the base URL (instance) for this request. */
  baseUrl?: string;
};

/**
 * Authenticated fetch helper using identity headers instead of JWT.
 */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const serverPassword = getServerPassword();
  const rawIdentity = storage.get("identity");

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (!headers.has("Content-Type") && init.body && !isFormData) headers.set("Content-Type", "application/json");
  if (serverPassword) headers.set("X-Server-Password", serverPassword);

  if (rawIdentity) {
    const identity = rawIdentity;
    const { signatureB64, timestamp } = await signMessage(identity, "handshake");
    headers.set("X-Identity-PublicKey", identity.publicKeyB64);
    headers.set("X-Identity-Fingerprint", computeFingerprint(identity));
    headers.set("X-Identity-DisplayName", identity.displayName ?? "");
    headers.set("X-Identity-Signature", signatureB64);
    headers.set("X-Identity-Timestamp", String(timestamp));
  }

  const baseUrl = (init as ApiFetchInit).baseUrl || getServerUrl();
  // Remove our custom field so it doesn't get passed to fetch
  const { baseUrl: _ignored, ...rest } = init as ApiFetchInit;

  const res = await fetch(`${baseUrl}${path}`, { ...rest, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json?.error || `HTTP ${res.status}`), { response: { data: json, status: res.status } });
  return json as T;
}
