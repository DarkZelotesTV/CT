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
import { resolveServerAssetUrl } from '../../utils/assetUrl';

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

export type TitleBarProps = {
  serverName?: string;
  serverIcon?: string | null;
  channel?: ChannelLike | null;
  onOpenServerSettings?: () => void;
  onOpenUserSettings?: () => void;
};

export const TitleBar = ({ 
  serverName, 
  serverIcon, 
  channel, 
  onOpenServerSettings, 
  onOpenUserSettings 
}: TitleBarProps) => {
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
    controls.getState().then((s) => {
        setState({
          isMaximized: !!s.isMaximized,
          isFullScreen: !!s.isFullScreen,
          platform: s.platform,
          titlebarHeight: s.titlebarHeight ?? DEFAULT_TITLEBAR_HEIGHT,
        });
      }).catch(() => {});

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
    document.documentElement.style.setProperty('--ct-titlebar-height', `${state.titlebarHeight}px`);
  }, [state.titlebarHeight]);

  if (!controls) return null;

  const platform = state.platform ?? 'win32';
  const isMac = platform === 'darwin';

  const windowBtnBase = 'no-drag h-full px-4 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition ' + focusRing;
  const iconButtonBase = 'no-drag h-full px-3 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition ' + focusRing;

  const left = slots.left ?? (
    <div className="flex items-center h-full px-4 select-none">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Clover Talk <span className="text-blue-500">Beta</span>
        </span>
      </div>
    </div>
  );

  const defaultCenter = (
    <div className="flex items-center gap-2 pointer-events-none select-none">
        {serverName ? (
          <>
            {serverIcon ? (
              <img 
                src={resolveServerAssetUrl(serverIcon)} 
                alt="Server Icon" 
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center text-[8px] text-white">
                {serverName.substring(0, 1)}
              </div>
            )}
            <span className="text-xs text-neutral-300 font-medium">
              {serverName}
            </span>
          </>
        ) : (
             <span className="text-xs text-neutral-400">Home</span>
        )}
    </div>
  );

  const center = slots.center ?? defaultCenter;

  const right = (
    <div className="flex items-center h-full">
      {slots.right}
      <div className="flex items-center h-full">
        <button
          type="button"
          className={iconButtonBase}
          aria-label={t('titlebar.settings', { defaultValue: 'Einstellungen' })}
          title={t('titlebar.settings', { defaultValue: 'Einstellungen' })}
          onClick={onOpenUserSettings} 
        >
          <Settings size={16} aria-hidden="true" />
        </button>

        <div className="relative group h-full flex items-center">
            <button className={iconButtonBase}><Globe size={16} /></button>
             <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer no-drag"
                value={settings.locale}
                onChange={(e) => updateLocale(e.target.value)}
              >
                <option value="en">EN</option>
                <option value="de">DE</option>
              </select>
        </div>

        <button type="button" className={iconButtonBase} onClick={() => setShowFeedback(true)} title="Feedback">
          <MessageSquare size={16} aria-hidden="true" />
        </button>
        <button type="button" className={iconButtonBase} onClick={() => setShowNotifications(true)}>
          <Bell size={16} aria-hidden="true" />
        </button>
        <button type="button" className={iconButtonBase} onClick={() => setShowInbox(true)}>
          <Inbox size={16} aria-hidden="true" />
        </button>
        <button type="button" className={iconButtonBase} onClick={() => setShowHelp(true)}>
          <HelpCircle size={16} aria-hidden="true" />
        </button>
      </div>

      {!isMac && (
        <div className="flex items-center h-full border-l border-white/5">
          <button type="button" className={windowBtnBase} onClick={() => void controls.minimize()}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <button type="button" className={windowBtnBase} onClick={() => void controls.toggleMaximize()}>
            {state.isMaximized ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          </button>
          <button type="button" className={`${windowBtnBase} hover:bg-red-500 hover:text-white`} onClick={() => void controls.close()}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[3000] drag border-b border-black bg-[#111] select-none"
        style={{ height: state.titlebarHeight }}
      >
        <div className="h-full w-full flex items-center justify-between">
          <div className="flex items-center h-full">{left}</div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{center}</div>
          <div className="flex items-center h-full justify-end">{right}</div>
        </div>
      </div>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showNotifications && (
        <ModalLayout title={t('titlebar.notifications')} onClose={() => setShowNotifications(false)}>
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed"><p>{t('titlebar.notificationsEmpty')}</p></div>
        </ModalLayout>
      )}
      {showInbox && (
        <ModalLayout title={t('titlebar.inbox')} onClose={() => setShowInbox(false)}>
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed"><p>{t('titlebar.inboxEmpty')}</p></div>
        </ModalLayout>
      )}
      {showHelp && (
        <ModalLayout title={t('titlebar.help')} onClose={() => setShowHelp(false)}>
          <div className="space-y-3 text-gray-200 text-sm leading-relaxed"><p>{t('titlebar.helpOverview')}</p></div>
        </ModalLayout>
      )}
    </>
  );
};