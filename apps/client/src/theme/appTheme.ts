import type { ThemeSettings } from '../context/SettingsContext';

export type ThemeMode = ThemeSettings['mode'];

export type AppTheme = {
  mode: ThemeMode;
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
};

const darkBase: Omit<AppTheme, 'mode' | 'accent' | 'accentHover'> = {
  background: '#050507',
  surface: '#0e0e11',
  surfaceAlt: '#111214',
  surfaceHover: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#ffffff',
  textMuted: '#9ca3af',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const lightBase: Omit<AppTheme, 'mode' | 'accent' | 'accentHover'> = {
  background: '#f3f4f6',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceHover: 'rgba(0, 0, 0, 0.04)',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  text: '#0f172a',
  textMuted: '#475569',
  overlay: 'rgba(255, 255, 255, 0.65)',
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

export const buildAppTheme = (mode: ThemeMode, accentColor: string): AppTheme => {
  const accent = accentColor || '#6366f1';
  const hoverDelta = mode === 'dark' ? -12 : 12;
  const base = mode === 'dark' ? darkBase : lightBase;

  return {
    mode,
    ...base,
    accent,
    accentHover: adjustHexColor(accent, hoverDelta),
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
    '--color-border': theme.border,
    '--color-border-strong': theme.borderStrong,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-overlay': theme.overlay,
  };

  Object.entries(entries).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.themeMode = theme.mode;
};
