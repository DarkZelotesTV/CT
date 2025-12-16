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

export const deriveServerThemeFromSettings = (settings?: any): ServerTheme => {
  const source = settings?.theme || settings?.appearance || settings?.colors || settings || {};

  const partial: Partial<ServerTheme> = {
    background: source.background ?? source.bg ?? source.base,
    surface: source.surface ?? source.surfaceBase,
    surfaceAlt: source.surfaceAlt ?? source.panel,
    surfaceHover: source.surfaceHover ?? source.hover,
    border: source.border,
    borderStrong: source.borderStrong,
    text: source.text,
    textMuted: source.textMuted ?? source.muted,
    accent: source.accent ?? source.primary,
    accentHover: source.accentHover ?? source.primaryHover,
    overlay: source.overlay,
  };

  return resolveServerTheme(partial);
};
