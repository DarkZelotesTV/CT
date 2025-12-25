import { getServerUrl } from './apiConfig';

const isAbsoluteUrl = (value: string) => /^(https?:|data:|blob:|file:|app:|electron:)/i.test(value);

/**
 * Löst relative Server-Asset-Pfade wie "/uploads/avatars/xyz.png" zu einer absoluten URL auf,
 * basierend auf der konfigurierten Server-URL (z. B. "https://localhost:3001/uploads/avatars/xyz.png").
 *
 * Wichtig für Electron Builds, in denen der Renderer-Origin "file://" ist.
 */
export const resolveServerAssetUrl = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (isAbsoluteUrl(raw)) return raw;

  const base = getServerUrl();

  // "/uploads/..." -> "https://localhost:3001/uploads/..."
  if (raw.startsWith('/')) return `${base}${raw}`;

  // "uploads/..." oder "./uploads/..." -> "https://localhost:3001/uploads/..."
  return `${base}/${raw.replace(/^\.\//, '')}`;
};
