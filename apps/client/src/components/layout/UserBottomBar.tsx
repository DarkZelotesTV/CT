import { useMemo, useState } from 'react';
import { Headphones, MessageSquare, MicOff, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import { useVoice } from '../../features/voice';
import { useSocket } from '../../context/SocketContext';
import { storage } from '../../shared/config/storage';
import { FeedbackModal } from '../modals/FeedbackModal';

export const UserBottomBar = () => {
  const { settings, updateLocale } = useSettings();
  const user = useMemo(() => storage.get('cloverUser'), []);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const { t } = useTranslation();

  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;

  const { micMuted, muted, setMicMuted, setMuted } = useVoice();
  const { isConnected } = useSocket();
  const handleLocaleChange = (locale: string) => updateLocale(locale);

  const displayName = settings.profile.displayName || user?.username || t('userBottomBar.fallbackDisplayName');
  const avatarSrc = resolveServerAssetUrl(settings.profile.avatarUrl || (user as any)?.avatar_url || '');

  return (
    <>
      <div className="h-16 bg-dark-200 border-t border-dark-400 flex items-center justify-between px-3 gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-cyan-700 flex items-center justify-center text-white text-sm font-bold">
  {avatarSrc ? (
    <img src={avatarSrc} className="w-full h-full object-cover" alt={`${displayName} Avatar`} />
  ) : (
    (displayName?.[0] ?? 'U').toUpperCase()
  )}
</div>
          <div className="min-w-0">
            <div className="text-sm text-gray-200 font-semibold truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate">
              {isConnected ? t('userBottomBar.online') : t('userBottomBar.offline')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language + Feedback wurden in der Desktop-App in die Titlebar verschoben */}
          {!isDesktop && (
            <>
              <label className="sr-only" htmlFor="language-select">
                {t('userBottomBar.languageLabel')}
              </label>
              <select
                id="language-select"
                className="bg-dark-100 text-gray-200 text-xs px-2 py-1 rounded border border-dark-400"
                value={settings.locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>

              <button
                className="px-2 py-1 rounded text-gray-100 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/30 text-[11px] font-semibold flex items-center gap-1"
                onClick={() => setShowFeedback(true)}
                title={t('userBottomBar.feedback')}
              >
                <MessageSquare size={14} aria-hidden="true" />
                <span className="hidden sm:inline">{t('userBottomBar.feedback')}</span>
              </button>
            </>
          )}

          <button
            className={`p-1 rounded ${
              micMuted ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'
            }`}
            onClick={() => setMicMuted(!micMuted)}
            title={micMuted ? t('userBottomBar.unmuteMic') : t('userBottomBar.muteMic')}
          >
            <MicOff size={14} />
          </button>

          <button
            className={`p-1 rounded ${
              muted ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'
            }`}
            onClick={() => setMuted(!muted)}
            title={muted ? t('userBottomBar.unmuteAll') : t('userBottomBar.muteAll')}
          >
            <Headphones size={14} />
          </button>

          <button
            className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"
            onClick={() => setShowSettings(true)}
            title={t('userBottomBar.settings')}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
      {!isDesktop && showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
};
