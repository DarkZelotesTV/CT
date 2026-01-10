import type { ThemeSettings } from '../context/SettingsContext';

export type ThemeMode = ThemeSettings['mode'];
export type ThemeDensity = ThemeSettings['density'];

export type AppTheme = {
  mode: ThemeMode;
  accent: string;
  accentHover: string;
  onAccent: string;
};

type BaseTheme = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
};

const darkBase: BaseTheme = {
  background: '#0b1021',
  surface: '#111827',
  surfaceAlt: '#0f1625',
  surfaceHover: '#1f2937',
  border: '#1f2a3a',
  borderStrong: '#303a4e',
  text: '#e5e7eb',
  textMuted: '#cbd5e1',
};

const lightBase: BaseTheme = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceAlt: '#eef2ff',
  surfaceHover: '#e2e8f0',
  border: '#cbd5e1',
  borderStrong: '#94a3b8',
  text: '#0f172a',
  textMuted: '#475569',
};

const clamp = (value: number) => Math.min(255, Math.max(0, value));

export const MIN_ACCENT_CONTRAST = 3;

const normalizeHex = (hex: string) => {
  if (!hex.startsWith('#')) return null;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length === 7) return hex;
  return null;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
};

const relativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
};

const contrastRatio = (hexA: string, hexB: string) => {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  if (lumA === null || lumB === null) return 1;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

const adjustHexColor = (hex: string, delta: number) => {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const r = clamp(parseInt(normalized.slice(1, 3), 16) + delta);
  const g = clamp(parseInt(normalized.slice(3, 5), 16) + delta);
  const b = clamp(parseInt(normalized.slice(5, 7), 16) + delta);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
};

const hexToRgbValues = (hex: string) => {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return null;

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  return `${r} ${g} ${b}`;
};

const getAccentMetrics = (accent: string, surface: string, text: string) => {
  const surfaceContrast = contrastRatio(accent, surface);
  const textContrast = contrastRatio(accent, text);
  return {
    surfaceContrast,
    textContrast,
    minContrast: Math.min(surfaceContrast, textContrast),
  };
};

const findBestAccent = (accent: string, surface: string, text: string, minContrast: number) => {
  const deltas = Array.from({ length: 41 }, (_, index) => (index - 20) * 6);
  const candidates = deltas.map((delta) => ({ delta, color: adjustHexColor(accent, delta) }));
  let best = { color: accent, delta: 0, ...getAccentMetrics(accent, surface, text) };
  let bestPassing: typeof best | null = null;

  for (const candidate of candidates) {
    const metrics = getAccentMetrics(candidate.color, surface, text);
    const entry = { color: candidate.color, delta: candidate.delta, ...metrics };
    if (metrics.surfaceContrast >= minContrast && metrics.textContrast >= minContrast) {
      if (!bestPassing || Math.abs(entry.delta) < Math.abs(bestPassing.delta)) {
        bestPassing = entry;
      }
    }
    if (metrics.minContrast > best.minContrast || (metrics.minContrast === best.minContrast && Math.abs(entry.delta) < Math.abs(best.delta))) {
      best = entry;
    }
  }

  return bestPassing ?? best;
};

const computeAccentHover = (accent: string, surface: string, text: string, minContrast: number) => {
  const baseMetrics = getAccentMetrics(accent, surface, text);
  const targetSurface = Math.max(baseMetrics.surfaceContrast + 0.3, minContrast);
  const deltas = Array.from({ length: 20 }, (_, index) => (index + 1) * 6);
  const candidates = deltas.flatMap((delta) => [
    { delta, color: adjustHexColor(accent, delta) },
    { delta: -delta, color: adjustHexColor(accent, -delta) },
  ]);

  type AccentCandidate = {
    color: string;
    delta: number;
    surfaceContrast: number;
    textContrast: number;
    minContrast: number;
  };
  let best: AccentCandidate | null = null;
  let fallback: AccentCandidate | null = null;

  for (const candidate of candidates) {
    const metrics = getAccentMetrics(candidate.color, surface, text);
    if (metrics.textContrast >= minContrast) {
      if (!fallback || metrics.surfaceContrast > fallback.surfaceContrast) {
        fallback = { color: candidate.color, delta: candidate.delta, ...metrics };
      }
      if (metrics.surfaceContrast >= targetSurface) {
        if (!best || Math.abs(candidate.delta) < Math.abs(best.delta)) {
          best = { color: candidate.color, delta: candidate.delta, ...metrics };
        }
      }
    }
  }

  return best?.color ?? fallback?.color ?? accent;
};

const computeOnAccent = (accent: string, text: string, background: string) => {
  const textContrast = contrastRatio(accent, text);
  const backgroundContrast = contrastRatio(accent, background);
  return textContrast >= backgroundContrast ? text : background;
};

export const getThemeContrastTargets = (mode: ThemeMode) => {
  const base = mode === 'dark' ? darkBase : lightBase;
  return { surface: base.surface, text: base.text };
};

export const getAccentContrastReport = (
  accent: string,
  surface: string,
  text: string,
  minContrast: number = MIN_ACCENT_CONTRAST
) => {
  const resolvedAccent = normalizeHex(accent) ?? '#6366f1';
  const metrics = getAccentMetrics(resolvedAccent, surface, text);
  const best = findBestAccent(resolvedAccent, surface, text, minContrast);
  return {
    accent: resolvedAccent,
    surfaceContrast: metrics.surfaceContrast,
    textContrast: metrics.textContrast,
    meetsContrast: metrics.surfaceContrast >= minContrast && metrics.textContrast >= minContrast,
    adjustedAccent: best.color,
    adjustedSurfaceContrast: best.surfaceContrast,
    adjustedTextContrast: best.textContrast,
  };
};

export const buildAppTheme = (mode: ThemeMode, accentColor: string): AppTheme => {
  const base = mode === 'dark' ? darkBase : lightBase;
  const accentFallback = normalizeHex(accentColor || '#6366f1') ?? '#6366f1';
  const { adjustedAccent } = getAccentContrastReport(accentFallback, base.surface, base.text);
  const accent = adjustedAccent;

  return {
    mode,
    accent,
    accentHover: computeAccentHover(accent, base.surface, base.text, MIN_ACCENT_CONTRAST),
    onAccent: computeOnAccent(accent, base.text, base.background),
  };
};

export const applyAppTheme = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const orb1Rgb = hexToRgbValues(theme.accent) ?? '16 185 129';
  const entries: Record<string, string> = {
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-on-accent': theme.onAccent,
    '--decor-orb-1-rgb': orb1Rgb,
  };

  Object.entries(entries).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.themeMode = theme.mode;
};

const densityScales: Record<ThemeDensity, number> = {
  comfortable: 1,
  compact: 0.9,
};

export const applyDensitySettings = (density: ThemeDensity) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const scale = densityScales[density] ?? densityScales.comfortable;
  root.style.setProperty('--density-scale', String(scale));
  root.dataset.density = density;
};
