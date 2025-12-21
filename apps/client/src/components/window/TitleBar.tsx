import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Globe,
  Hash,
  HelpCircle,
  Inbox,
  Maximize2,
  Minus,
  Minimize2,
  MessageSquare,
  Settings,
  Volume2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { FeedbackModal } from '../modals/FeedbackModal';
import { ModalLayout } from '../modals/ModalLayout';
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

const DEFAULT_TITLEBAR_HEIGHT = 48;

function getControls() {
  if (typeof window === 'undefined') return null;
  return window.ct?.windowControls ?? null;
}

function channelIcon(type?: ChannelLike['type']) {
  const iconBase = 'text-gray-400';
  switch (type) {
    case 'voice':
      return <Volume2 size={14} className={iconBase} aria-hidden="true" />;
    case 'web':
      return <Globe size={14} className={iconBase} aria-hidden="true" />;
    case 'text':
    default:
      return <Hash size={14} className={iconBase} aria-hidden="true" />;
  }
}

export type TitleBarProps = {
  serverName?: string;
  channel?: ChannelLike | null;
  onOpenServerSettings?: () => void;
};

/**
 * Custom Titlebar für Electron (frameless window) – ersetzt die komplette obere Header-Leiste.
 * - Drag Region: `.drag`
 * - Klickbare Bereiche: `.no-drag`
 * - Window Controls via preload (window.ct.windowControls)
 */
export const TitleBar = ({ serverName, channel, onOpenServerSettings }: TitleBarProps) => {
  const controls = useMemo(getControls, []);
  const { t } = useTranslation();
  const { slots } = useTopBar();
  const { settings, updateLocale } = useSettings();

  const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

  const [showFeedback, setShowFeedback] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [state, setState] = useState<WindowState>({
    isMaximized: false,
    isFullScreen: false,
    titlebarHeight: DEFAULT_TITLEBAR_HEIGHT,
  });

  useEffect(() => {
    if (!controls) return;

    let off: null | (() => void) = null;
    controls
      .getState()
      .then((s) => {
        const next: WindowState = {
          isMaximized: !!s.isMaximized,
          isFullScreen: !!s.isFullScreen,
          platform: s.platform,
          titlebarHeight: s.titlebarHeight ?? DEFAULT_TITLEBAR_HEIGHT,
        };
        setState(next);
      })
      .catch(() => {
        // ignore
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

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.style.setProperty(
      '--ct-titlebar-height',
      `${state.titlebarHeight}px`,
    );
  }, [state.titlebarHeight]);

  if (!controls) return null;

  const channelTitle = channel?.name ?? t('titlebar.title', { defaultValue: 'Startpage' });

  const platform = state.platform ?? 'win32';
  const isMac = platform === 'darwin';

  const windowBtnBase =
    'no-drag h-8 w-10 flex items-center justify-center text-gray-300 hover:bg-white/10 active:bg-white/20 transition ' +
    focusRing;

  const macTrafficLights = (
    <div className="no-drag flex items-center gap-2 mr-2">
      <button
        type="button"
        className={`no-drag h-3.5 w-3.5 rounded-full bg-red-500/90 hover:bg-red-500 transition ${focusRing}`}
        onClick={() => void controls.close()}
        aria-label={t('titlebar.close', { defaultValue: 'Schließen' })}
        title={t('titlebar.close', { defaultValue: 'Schließen' })}
      />
      <button
        type="button"
        className={`no-drag h-3.5 w-3.5 rounded-full bg-yellow-500/90 hover:bg-yellow-500 transition ${focusRing}`}
        onClick={() => void controls.minimize()}
        aria-label={t('titlebar.minimize', { defaultValue: 'Minimieren' })}
        title={t('titlebar.minimize', { defaultValue: 'Minimieren' })}
      />
      <button
        type="button"
        className={`no-drag h-3.5 w-3.5 rounded-full bg-green-500/90 hover:bg-green-500 transition ${focusRing}`}
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
      />
    </div>
  );

  const left = slots.left ?? (
    <div className="flex items-center gap-2">
      {isMac ? macTrafficLights : null}

      <button
        type="button"
        className={`no-drag h-7 w-7 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center ${focusRing}`}
        aria-label={t('titlebar.openServerSettings', { defaultValue: 'Server-Einstellungen' })}
        title={t('titlebar.openServerSettings', { defaultValue: 'Server-Einstellungen' })}
        onClick={onOpenServerSettings}
        disabled={!onOpenServerSettings}
      >
        <Settings size={16} className="text-gray-200" aria-hidden="true" />
      </button>

      <div className="no-drag h-6 w-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-200">
        CloverTalk BETA
      </div>
    </div>
  );

  const defaultCenter = (
    <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 max-w-[720px]">
      <div className="flex items-center gap-2 text-[13px] text-gray-200 leading-tight truncate">
        {serverName ? (
          <>
            <span className="text-gray-300 truncate" title={serverName}>
              {serverName}
            </span>
            <span className="text-gray-500" aria-hidden="true">
              @
            </span>
          </>
        ) : null}

        <span className="flex items-center gap-1 min-w-0">
          {channel ? channelIcon(channel.type) : null}
          <span className="truncate" title={channelTitle}>
            {channelTitle}
          </span>
        </span>
      </div>
    </div>
  );

  const center = slots.center ?? defaultCenter;

  const right = (
    <div className="flex items-center gap-1">
      {slots.right}

      <div className="flex items-center gap-1">
        {/* Language */}
        <div
          className={`no-drag h-8 px-2 rounded-md bg-white/5 border border-white/10 flex items-center gap-2 ${focusRing}`}
          aria-label={t('userBottomBar.languageLabel', { defaultValue: 'Sprache' })}
          title={t('userBottomBar.languageLabel', { defaultValue: 'Sprache' })}
        >
          <Globe size={14} className="text-gray-300" aria-hidden="true" />
          <select
            className="no-drag bg-transparent text-gray-200 text-[12px] outline-none"
            value={settings.locale}
            onChange={(e) => updateLocale(e.target.value)}
          >
            <option value="en">EN</option>
            <option value="de">DE</option>
          </select>
        </div>

        {/* Feedback */}
        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('userBottomBar.feedback', { defaultValue: 'Feedback' })}
          title={t('userBottomBar.feedback', { defaultValue: 'Feedback' })}
          onClick={() => setShowFeedback(true)}
        >
          <MessageSquare size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        {/* Existing icons */}
        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.notifications', { defaultValue: 'Benachrichtigungen' })}
          title={t('titlebar.notifications', { defaultValue: 'Benachrichtigungen' })}
          onClick={() => setShowNotifications(true)}
        >
          <Bell size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.inbox', { defaultValue: 'Inbox' })}
          title={t('titlebar.inbox', { defaultValue: 'Inbox' })}
          onClick={() => setShowInbox(true)}
        >
          <Inbox size={16} className="text-gray-300" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`no-drag h-8 w-8 rounded-md hover:bg-white/10 active:bg-white/20 flex items-center justify-center ${focusRing}`}
          aria-label={t('titlebar.help', { defaultValue: 'Hilfe' })}
          title={t('titlebar.help', { defaultValue: 'Hilfe' })}
          onClick={() => setShowHelp(true)}
        >
          <HelpCircle size={16} className="text-gray-300" aria-hidden="true" />
        </button>
      </div>

      {/* Window Controls */}
      {!isMac && (
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
            {state.isMaximized ? (
              <Minimize2 size={16} className="text-gray-200" aria-hidden="true" />
            ) : (
              <Maximize2 size={16} className="text-gray-200" aria-hidden="true" />
            )}
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
      )}
    </div>
  );

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[3000] drag border-b border-white/10 bg-black/70 backdrop-blur-md"
        style={{ height: state.titlebarHeight }}
      >
        <div className="h-full w-full flex items-center gap-3 px-3">
          <div className="min-w-[180px] max-w-[320px] flex items-center">{left}</div>

          <div className="flex-1 flex justify-center">{center}</div>

          <div className="min-w-[360px] flex justify-end">{right}</div>
        </div>
      </div>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showNotifications && (
        <ModalLayout
          title={t('titlebar.notifications', { defaultValue: 'Benachrichtigungen' })}
          description={t('titlebar.notificationsDescription', {
            defaultValue: 'Aktuelle Hinweise aus deinen Servern und Kanälen',
          })}
          onClose={() => setShowNotifications(false)}
          onOverlayClick={() => setShowNotifications(false)}
        >
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed">
            <p>{t('titlebar.notificationsEmpty', { defaultValue: 'Keine neuen Benachrichtigungen.' })}</p>
            <p className="text-gray-400">
              {t('titlebar.notificationsHint', {
                defaultValue: 'Hinweise erscheinen hier, sobald es Erwähnungen oder Server-Aktivitäten gibt.',
              })}
            </p>
          </div>
        </ModalLayout>
      )}
      {showInbox && (
        <ModalLayout
          title={t('titlebar.inbox', { defaultValue: 'Inbox' })}
          description={t('titlebar.inboxDescription', {
            defaultValue: 'Direktnachrichten, Anfragen und ungelesene Unterhaltungen',
          })}
          onClose={() => setShowInbox(false)}
          onOverlayClick={() => setShowInbox(false)}
        >
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed">
            <p>{t('titlebar.inboxEmpty', { defaultValue: 'Deine Inbox ist leer.' })}</p>
            <p className="text-gray-400">
              {t('titlebar.inboxHint', {
                defaultValue: 'Neue Nachrichten oder Einladungen erscheinen hier, sobald sie eintreffen.',
              })}
            </p>
          </div>
        </ModalLayout>
      )}
      {showHelp && (
        <ModalLayout
          title={t('titlebar.help', { defaultValue: 'Hilfe' })}
          description={t('titlebar.helpDescription', {
            defaultValue: 'Antworten finden oder Feedback geben',
          })}
          onClose={() => setShowHelp(false)}
          onOverlayClick={() => setShowHelp(false)}
        >
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed">
            <p>
              {t('titlebar.helpOverview', {
                defaultValue: 'Schau in die FAQ oder sende uns direkt Feedback, wenn du Unterstützung brauchst.',
              })}
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>{t('titlebar.helpFaq', { defaultValue: 'FAQ & Kurzinfos' })}</li>
              <li>{t('titlebar.helpContact', { defaultValue: 'Kontaktiere das Team über Feedback oder Support.' })}</li>
            </ul>
          </div>
        </ModalLayout>
      )}
    </>
  );
};