const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Authenticated fetch helper (uses the app JWT stored in localStorage under "clover_token").
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("clover_token");
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}
