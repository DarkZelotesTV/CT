import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Copy,
  Globe,
  Hash,
  HelpCircle,
  Inbox,
  Minus,
  Pin,
  Search,
  Settings,
  Square,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTopBar } from './TopBarContext';

type WindowState = {
  isMaximized: boolean;
  isFullScreen: boolean;
  platform?: string;
  titlebarHeight: number;
};

type ChannelLike = {
  id?: number;
  name: string;
  type?: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
};

function getControls() {
  if (typeof window === 'undefined') return null;
  return window.ct?.windowControls ?? null;
}

function channelIcon(type?: ChannelLike['type']) {
  switch (type) {
    case 'voice':
      return <Volume2 size={16} className="text-gray-400" aria-hidden="true" />;
    case 'web':
      return <Globe size={16} className="text-gray-400" aria-hidden="true" />;
    case 'text':
    default:
      return <Hash size={16} className="text-gray-400" aria-hidden="true" />;
  }
}

export type TitleBarProps = {
  serverName?: string;
  channel?: ChannelLike | null;
  showRightSidebar?: boolean;
  onToggleRightSidebar?: () => void;
  onOpenServerSettings?: () => void;
};

/**
 * Custom Titlebar für Electron (frameless window) – ersetzt die komplette obere Header-Leiste.
 * - Drag Region: `.drag`
 * - Klickbare Bereiche: `.no-drag`
 * - Window Controls via preload (window.ct.windowControls)
 */
export const TitleBar = ({
  serverName,
  channel,
  showRightSidebar = true,
  onToggleRightSidebar,
  onOpenServerSettings,
}: TitleBarProps) => {
  const controls = useMemo(getControls, []);
  const { t } = useTranslation();
  const { slots } = useTopBar();
  const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

  const [state, setState] = useState<WindowState>({
    isMaximized: false,
    isFullScreen: false,
    titlebarHeight: 48,
  });

  useEffect(() => {
    let off: (() => void) | undefined;

    if (!controls) return;

    void controls.getState().then((s) => {
      const next: WindowState = {
        isMaximized: !!s.isMaximized,
        isFullScreen: !!s.isFullScreen,
        titlebarHeight: s.titlebarHeight ?? 48,
      };

      // With `exactOptionalPropertyTypes`, don't assign `undefined` to optional props.
      if (typeof s.platform === 'string') next.platform = s.platform;

      setState(next);
    });

    off = controls.onStateChange((s) => {
      setState((prev) => ({
        ...prev,
        isMaximized: !!s.isMaximized,
        isFullScreen: !!s.isFullScreen,
      }));
    });

    return () => off?.();
  }, [controls]);

  if (!controls) return null;

  const title = channel?.name ?? t('titlebar.title', { defaultValue: 'CT' });
  const placeholder = serverName
    ? t('titlebar.searchPlaceholder', { defaultValue: '{{server}} suchen', server: serverName })
    : t('titlebar.searchPlaceholderFallback', { defaultValue: 'Suchen…' });

  const windowBtnBase =
    'no-drag h-8 w-10 flex items-center justify-center text-gray-300 hover:bg-white/10 active:bg-white/20 transition ' +
    focusRing;

  const left = slots.left ?? (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        className={`no-drag h-7 w-7 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center ${focusRing}`}
        aria-label={t('titlebar.openServerSettings', { defaultValue: 'Server-Einstellungen' })}
        title={t('titlebar.openServerSettings', { defaultValue: 'Server-Einstellungen' })}
        onClick={onOpenServerSettings}
      >
        <Settings size={16} className="text-gray-200" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <div className="no-drag h-6 w-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-200">
          CT
        </div>

        <div className="min-w-0">
          <div className="text-[11px] text-gray-400 leading-tight truncate">{serverName ?? '—'}</div>
          <div className="flex items-center gap-2 text-[13px] text-gray-200 leading-tight truncate">
            {channelIcon(channel?.type)}
            <span className="truncate" title={title}>
              {title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const center = slots.center ?? (
    <div className="w-full max-w-[720px] px-3">
      <div className="no-drag relative">
        <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-full h-8 pl-8 pr-3 rounded-md bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm text-gray-200 placeholder:text-gray-500"
          // (optional) -> hier könntest du später ein Search-Modal öffnen statt "echtem" Input
        />
      </div>
    </div>
  );

  const right = (
    <div className="flex items-center gap-1">
      {slots.right}

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.copyChannel', { defaultValue: 'Channel-Link kopieren' })}
          title={t('titlebar.copyChannel', { defaultValue: 'Channel-Link kopieren' })}
          onClick={() => void navigator.clipboard?.writeText(title)}
        >
          <Copy size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.pins', { defaultValue: 'Pins' })}
          title={t('titlebar.pins', { defaultValue: 'Pins' })}
        >
          <Pin size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.notifications', { defaultValue: 'Benachrichtigungen' })}
          title={t('titlebar.notifications', { defaultValue: 'Benachrichtigungen' })}
        >
          <Bell size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.members', { defaultValue: 'Mitglieder' })}
          title={t('titlebar.members', { defaultValue: 'Mitglieder' })}
          onClick={onToggleRightSidebar}
        >
          <Users
            size={16}
            className={showRightSidebar ? 'text-gray-200' : 'text-gray-300'}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.inbox', { defaultValue: 'Inbox' })}
          title={t('titlebar.inbox', { defaultValue: 'Inbox' })}
        >
          <Inbox size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.help', { defaultValue: 'Hilfe' })}
          title={t('titlebar.help', { defaultValue: 'Hilfe' })}
        >
          <HelpCircle size={16} className="text-gray-300" aria-hidden="true" />
        </button>
      </div>

      {/* Window Controls */}
      <div className="ml-2 flex items-center">
        <button
          type="button"
          className={windowBtnBase}
          onClick={() => void controls.minimize()}
          aria-label={t('titlebar.minimize', { defaultValue: 'Minimieren' })}
          title={t('titlebar.minimize', { defaultValue: 'Minimieren' })}
        >
          <Minus size={16} className="text-gray-200" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={windowBtnBase}
          onClick={() => void controls.toggleMaximize()}
          aria-label={
            state.isMaximized
              ? t('titlebar.restore', { defaultValue: 'Wiederherstellen' })
              : t('titlebar.maximize', { defaultValue: 'Maximieren' })
          }
          title={
            state.isMaximized
              ? t('titlebar.restore', { defaultValue: 'Wiederherstellen' })
              : t('titlebar.maximize', { defaultValue: 'Maximieren' })
          }
        >
          <Square size={14} className="text-gray-200" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={windowBtnBase + ' hover:bg-red-500/30 hover:text-white'}
          onClick={() => void controls.close()}
          aria-label={t('titlebar.close', { defaultValue: 'Schließen' })}
          title={t('titlebar.close', { defaultValue: 'Schließen' })}
        >
          <X size={16} className="text-gray-200" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 drag border-b border-white/10 bg-black/70 backdrop-blur-md"
      style={{ height: state.titlebarHeight }}
    >
      <div className="h-full w-full flex items-center gap-3 px-3">
        <div className="min-w-[260px] max-w-[420px] flex items-center">{left}</div>

        <div className="flex-1 flex justify-center">{center}</div>

        <div className="min-w-[360px] flex justify-end">{right}</div>
      </div>
    </div>
  );
};
