import type { ThemeSettings } from '../context/SettingsContext';

export type ThemeMode = ThemeSettings['mode'];

export type AppTheme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  surfaceBody: string;
  surfaceRail: string;
  surfaceTree: string;
  surfaceMain: string;
  surfaceInfo: string;
  surfaceLog: string;
  surfaceHeader: string;
  surfaceTint: string;
  border: string;
  borderStrong: string;
  borderGlass: string;
  borderShine: string;
  borderSubtle: string;
  shadowPanelInset: string;
  shadowPanel: string;
  shadowPanelStrong: string;
  shadowColor: string;
  shadow1: string;
  shadow2: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  focus: string;
  overlay: string;
};

type BaseTheme = Pick<
  AppTheme,
  | 'background'
  | 'surface'
  | 'surfaceAlt'
  | 'surfaceHover'
  | 'border'
  | 'borderStrong'
  | 'text'
  | 'textMuted'
  | 'overlay'
>;

const darkBase: BaseTheme = {
  background: '#0b1021',
  surface: '#111827',
  surfaceAlt: '#0f1625',
  surfaceHover: '#1f2937',
  border: '#1f2a3a',
  borderStrong: '#303a4e',
  text: '#e5e7eb',
  textMuted: '#cbd5e1',
  overlay: 'rgba(6, 8, 16, 0.78)',
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
  overlay: 'rgba(15, 23, 42, 0.28)',
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

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const glassBase = mode === 'dark' ? '#ffffff' : base.text;
  const glassBorder = hexToRgba(glassBase, mode === 'dark' ? 0.08 : 0.12);
  const glassShine = hexToRgba(glassBase, mode === 'dark' ? 0.15 : 0.2);
  const surfaceBody = base.background;
  const surfaceRail = hexToRgba(base.surface, mode === 'dark' ? 0.9 : 0.92);
  const surfaceTree = hexToRgba(base.surfaceAlt, mode === 'dark' ? 0.85 : 0.9);
  const surfaceMain = hexToRgba(base.surface, mode === 'dark' ? 0.3 : 0.75);
  const surfaceInfo = hexToRgba(base.surfaceAlt, mode === 'dark' ? 0.85 : 0.92);
  const surfaceLog = hexToRgba(base.surface, mode === 'dark' ? 0.9 : 0.92);
  const surfaceHeader = hexToRgba(base.surfaceAlt, mode === 'dark' ? 0.88 : 0.96);
  const surfaceTint = mode === 'dark' ? '#ffffff' : '#ffffff';
  const shadowPanelInset = mode === 'dark'
    ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.03)'
    : `inset 0 0 0 1px ${hexToRgba(base.text, 0.08)}`;
  const borderSubtle = hexToRgba(mode === 'dark' ? '#ffffff' : base.border, mode === 'dark' ? 0.08 : 0.6);
  const shadowColor = mode === 'dark' ? '#000000' : base.text;
  const shadowPanel = mode === 'dark'
    ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.02)'
    : '0 10px 28px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.08)';
  const shadowPanelStrong = mode === 'dark'
    ? '0 -10px 40px rgba(0, 0, 0, 0.5)'
    : '0 -12px 30px rgba(15, 23, 42, 0.18)';
  const shadow1 = `0 24px 70px ${hexToRgba(shadowColor, mode === 'dark' ? 0.6 : 0.2)}`;
  const shadow2 = `0 12px 32px ${hexToRgba(shadowColor, mode === 'dark' ? 0.5 : 0.16)}`;

  return {
    mode,
    ...base,
    accent,
    accentHover: computeAccentHover(accent, base.surface, base.text, MIN_ACCENT_CONTRAST),
    onAccent: computeOnAccent(accent, base.text, base.background),
    focus: accent,
    surfaceBody,
    surfaceRail,
    surfaceTree,
    surfaceMain,
    surfaceInfo,
    surfaceLog,
    surfaceHeader,
    surfaceTint,
    borderGlass: glassBorder,
    borderShine: glassShine,
    borderSubtle,
    shadowPanelInset,
    shadowPanel,
    shadowPanelStrong,
    shadowColor,
    shadow1,
    shadow2,
  };
};

export const applyAppTheme = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const derivedSurfaceBody = `color-mix(in srgb, ${theme.background} 75%, ${theme.surface} 25%)`;
  const derivedSurfaceRail = `color-mix(in srgb, ${theme.surface} 92%, ${theme.background} 8%)`;
  const derivedSurfaceTree = `color-mix(in srgb, ${theme.surface} 84%, ${theme.background} 16%)`;
  const derivedSurfaceMain = `color-mix(in srgb, ${theme.surface} 70%, ${theme.background} 30%)`;
  const derivedSurfaceInfo = `color-mix(in srgb, ${theme.surface} 86%, ${theme.background} 14%)`;
  const derivedSurfaceLog = `color-mix(in srgb, ${theme.surface} 94%, ${theme.background} 6%)`;
  const derivedSurfaceHeader = `color-mix(in srgb, ${theme.surface} 88%, ${theme.background} 12%)`;
  const decorationVars =
    theme.mode === 'dark'
      ? {
          '--decor-noise-opacity': '0.06',
          '--decor-grid-opacity': '0.04',
          '--decor-grid-color': '#ffffff',
          '--decor-orb-1-color': theme.accent,
          '--decor-orb-2-color': '#60a5fa',
          '--decor-orb-1-opacity': '0.5',
          '--decor-orb-2-opacity': '0.4',
        }
      : {
          '--decor-noise-opacity': '0.035',
          '--decor-grid-opacity': '0.025',
          '--decor-grid-color': '#0f172a',
          '--decor-orb-1-color': theme.accent,
          '--decor-orb-2-color': '#2563eb',
          '--decor-orb-1-opacity': '0.25',
          '--decor-orb-2-opacity': '0.2',
        };
  const entries: Record<string, string> = {
    '--color-background': theme.background,
    '--color-surface': theme.surface,
    '--color-surface-alt': theme.surfaceAlt,
    '--color-surface-hover': theme.surfaceHover,
    '--color-surface-2': theme.surfaceAlt,
    '--color-surface-3': theme.surfaceHover,
    '--color-surface-body': derivedSurfaceBody,
    '--color-surface-rail': derivedSurfaceRail,
    '--color-surface-tree': derivedSurfaceTree,
    '--color-surface-main': derivedSurfaceMain,
    '--color-surface-info': derivedSurfaceInfo,
    '--color-surface-log': derivedSurfaceLog,
    '--color-surface-header': derivedSurfaceHeader,
    '--color-surface-tint': theme.surfaceTint,
    '--color-border': theme.border,
    '--color-border-strong': theme.borderStrong,
    '--color-border-glass': theme.borderGlass,
    '--color-border-shine': theme.borderShine,
    '--color-border-subtle': theme.borderSubtle,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-on-accent': theme.onAccent,
    '--accent': theme.accent,
    '--accent-hover': theme.accentHover,
    '--color-focus': theme.focus,
    '--color-overlay': theme.overlay,
    '--color-shadow': theme.shadowColor,
    '--shadow-panel-inset': theme.shadowPanelInset,
    '--shadow-panel': theme.shadowPanel,
    '--shadow-panel-strong': theme.shadowPanelStrong,
    '--shadow-1': theme.shadow1,
    '--shadow-2': theme.shadow2,
    '--layout-bg-body': derivedSurfaceBody,
    '--layout-bg-rail': derivedSurfaceRail,
    '--layout-bg-tree': derivedSurfaceTree,
    '--layout-bg-main': derivedSurfaceMain,
    '--layout-bg-info': derivedSurfaceInfo,
    '--layout-bg-log': derivedSurfaceLog,
    '--bg-body': derivedSurfaceBody,
    '--bg-rail': derivedSurfaceRail,
    '--bg-tree': derivedSurfaceTree,
    '--bg-main': derivedSurfaceMain,
    '--bg-info': derivedSurfaceInfo,
    '--bg-log': derivedSurfaceLog,
    ...decorationVars,
  };

  Object.entries(entries).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.themeMode = theme.mode;
};
