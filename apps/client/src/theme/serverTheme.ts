export interface ServerTheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  overlay: string;
}

export const defaultServerTheme: ServerTheme = {
  background: '#050507',
  surface: '#0e0e11',
  surfaceAlt: '#111214',
  surfaceHover: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#ffffff',
  textMuted: '#9ca3af',
  accent: '#6366f1',
  accentHover: '#4f46e5',
  overlay: 'rgba(0,0,0,0.7)',
};

export const resolveServerTheme = (theme?: Partial<ServerTheme> | null): ServerTheme => ({
  ...defaultServerTheme,
  ...(theme || {}),
});

const adjustAccent = (hex?: string) => {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const clamp = (value: number) => Math.min(255, Math.max(0, value));
  const r = clamp(parseInt(normalized.slice(1, 3), 16) - 10);
  const g = clamp(parseInt(normalized.slice(3, 5), 16) - 10);
  const b = clamp(parseInt(normalized.slice(5, 7), 16) - 10);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
};

export const deriveServerThemeFromSettings = (settings?: any, fallbackAccent?: string): ServerTheme => {
  const source = settings?.theme || settings?.appearance || settings?.colors || settings || {};

  const accent = source.accent ?? source.primary ?? fallbackAccent;
  const accentHover = source.accentHover ?? source.primaryHover ?? adjustAccent(accent);

  const partial: Partial<ServerTheme> = {
    background: source.background ?? source.bg ?? source.base,
    surface: source.surface ?? source.surfaceBase,
    surfaceAlt: source.surfaceAlt ?? source.panel,
    surfaceHover: source.surfaceHover ?? source.hover,
    border: source.border,
    borderStrong: source.borderStrong,
    text: source.text,
    textMuted: source.textMuted ?? source.muted,
    accent,
    accentHover,
    overlay: source.overlay,
  };

  return resolveServerTheme(partial);
};
