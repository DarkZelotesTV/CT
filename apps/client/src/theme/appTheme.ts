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
  border: string;
  borderStrong: string;
  borderGlass: string;
  borderShine: string;
  shadowPanelInset: string;
  shadowPanel: string;
  shadowPanelStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  overlay: string;
};

const darkBase: Omit<AppTheme, 'mode' | 'accent' | 'accentHover'> = {
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

const lightBase: Omit<AppTheme, 'mode' | 'accent' | 'accentHover'> = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceAlt: '#eef2ff',
  surfaceHover: '#e2e8f0',
  border: '#cbd5e1',
  borderStrong: '#94a3b8',
  text: '#0f172a',
  textMuted: '#475569',
  overlay: 'rgba(15, 23, 42, 0.4)',
};

const clamp = (value: number) => Math.min(255, Math.max(0, value));

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

export const buildAppTheme = (mode: ThemeMode, accentColor: string): AppTheme => {
  const accent = accentColor || '#6366f1';
  const hoverDelta = mode === 'dark' ? -12 : 12;
  const base = mode === 'dark' ? darkBase : lightBase;
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
  const shadowPanelInset = mode === 'dark'
    ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.03)'
    : `inset 0 0 0 1px ${hexToRgba(base.text, 0.08)}`;
  const shadowPanel = mode === 'dark'
    ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.02)'
    : '0 10px 28px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.08)';
  const shadowPanelStrong = mode === 'dark'
    ? '0 -10px 40px rgba(0, 0, 0, 0.5)'
    : '0 -12px 30px rgba(15, 23, 42, 0.18)';

  return {
    mode,
    ...base,
    accent,
    accentHover: adjustHexColor(accent, hoverDelta),
    surfaceBody,
    surfaceRail,
    surfaceTree,
    surfaceMain,
    surfaceInfo,
    surfaceLog,
    surfaceHeader,
    borderGlass: glassBorder,
    borderShine: glassShine,
    shadowPanelInset,
    shadowPanel,
    shadowPanelStrong,
  };
};

export const applyAppTheme = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const entries: Record<string, string> = {
    '--color-background': theme.background,
    '--color-surface': theme.surface,
    '--color-surface-alt': theme.surfaceAlt,
    '--color-surface-hover': theme.surfaceHover,
    '--color-surface-body': theme.surfaceBody,
    '--color-surface-rail': theme.surfaceRail,
    '--color-surface-tree': theme.surfaceTree,
    '--color-surface-main': theme.surfaceMain,
    '--color-surface-info': theme.surfaceInfo,
    '--color-surface-log': theme.surfaceLog,
    '--color-surface-header': theme.surfaceHeader,
    '--color-border': theme.border,
    '--color-border-strong': theme.borderStrong,
    '--color-border-glass': theme.borderGlass,
    '--color-border-shine': theme.borderShine,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-overlay': theme.overlay,
    '--shadow-panel-inset': theme.shadowPanelInset,
    '--shadow-panel': theme.shadowPanel,
    '--shadow-panel-strong': theme.shadowPanelStrong,
    '--layout-bg-body': theme.surfaceBody,
    '--layout-bg-rail': theme.surfaceRail,
    '--layout-bg-tree': theme.surfaceTree,
    '--layout-bg-main': theme.surfaceMain,
    '--layout-bg-info': theme.surfaceInfo,
    '--layout-bg-log': theme.surfaceLog,
    '--bg-body': theme.surfaceBody,
    '--bg-rail': theme.surfaceRail,
    '--bg-tree': theme.surfaceTree,
    '--bg-main': theme.surfaceMain,
    '--bg-info': theme.surfaceInfo,
    '--bg-log': theme.surfaceLog,
  };

  Object.entries(entries).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.themeMode = theme.mode;
};
