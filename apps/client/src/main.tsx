import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './theme/tempnew.css';

import { IdentityGate } from './auth/IdentityGate';
import { SocketProvider } from './context/SocketContext.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceProvider } from './features/voice';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { TopBarProvider } from './components/window/TopBarContext';
import { storage } from './shared/config/storage';
import { buildAppTheme } from './theme/appTheme';

const applyPreloadTheme = () => {
  if (typeof document === 'undefined') return;
  const stored = storage.get('settings') as { theme?: { mode?: 'light' | 'dark'; accentColor?: string } } | null;
  const mode = stored?.theme?.mode ?? 'dark';
  const accentColor = stored?.theme?.accentColor ?? '#6366f1';
  const theme = buildAppTheme(mode, accentColor);
  const root = document.documentElement;
  const entries: Record<string, string> = {
    '--color-background': theme.background,
    '--color-surface': theme.surface,
    '--color-surface-alt': theme.surfaceAlt,
    '--color-surface-hover': theme.surfaceHover,
    '--color-surface-tint': theme.surfaceTint,
    '--color-border': theme.border,
    '--color-border-strong': theme.borderStrong,
    '--color-border-subtle': theme.borderSubtle,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-focus': theme.focus,
    '--color-overlay': theme.overlay,
  };

  Object.entries(entries).forEach(([key, value]) => root.style.setProperty(key, value));
};

applyPreloadTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <TopBarProvider>
    <IdentityGate>
      <SettingsProvider>
        <SocketProvider>
          <VoiceProvider>
            <I18nextProvider i18n={i18n}>
              <App />
            </I18nextProvider>
          </VoiceProvider>
        </SocketProvider>
      </SettingsProvider>
    </IdentityGate>
  </TopBarProvider>,
);
