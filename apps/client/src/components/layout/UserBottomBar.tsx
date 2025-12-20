import { useMemo, useState } from 'react';
import { Headphones, MicOff, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { useVoice } from '../../features/voice';
import { useSocket } from '../../context/SocketContext';
import { storage } from '../../shared/config/storage';

export const UserBottomBar = () => {
  const { settings, updateLocale } = useSettings();
  const user = useMemo(() => storage.get('cloverUser'), []);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useTranslation();

  const { muted, micMuted, setMuted, setMicMuted } = useVoice();
  // NEU: Echter Verbindungsstatus vom Socket
  const { isConnected } = useSocket();

  // Priorisierung: Lokale Einstellung > Server DisplayName > Server Username > Fallback
  const displayName = settings.profile.displayName || user.displayName || user.username || t('userBottomBar.fallbackDisplayName');
  // Priorisierung: Lokale Einstellung > Server Avatar
  const avatarUrl = settings.profile.avatarUrl || user.avatar_url;

  // NEU: Statusfarbe basierend auf Socket-Verbindung
  const statusColor = isConnected ? 'bg-green-500' : 'bg-red-500';
  const statusText = isConnected ? t('userBottomBar.online') : t('userBottomBar.offline');

  const handleLocaleChange = (locale: string) => {
    updateLocale(locale);
  };

  return (
    <>
      <div className="p-3 bg-[var(--color-surface)] flex items-center gap-3 border-t border-[var(--color-border)]">
        <div className="w-8 h-8 bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50 rounded flex items-center justify-center text-[color:var(--color-accent)] font-bold text-xs relative overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full object-cover" alt="User Avatar" />
          ) : (
            displayName.substring(0, 1).toUpperCase()
          )}
          {/* NEU: Dynamischer Status-Indikator */}
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusColor} rounded-full border border-black animate-pulse`}
            title={statusText}
          ></div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold text-[color:var(--color-text)] truncate tracking-wider">{displayName}</div>
          <div className="text-[9px] text-[color:var(--color-text-muted)] uppercase tracking-widest">
            {t('userBottomBar.idLabel')}: {user.id || t('userBottomBar.unknownId')}
          </div>
        </div>

        <div className="flex gap-1 items-center">
          <label className="sr-only" htmlFor="locale-select">
            {t('userBottomBar.languageLabel')}
          </label>
          <select
            id="locale-select"
            className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200 focus:border-cyan-500/50 focus:outline-none"
            value={settings.locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
          <button
            className={`p-1 rounded ${micMuted ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'}`}
            onClick={() => setMicMuted(!micMuted)}
            title={micMuted ? t('userBottomBar.unmuteMic') : t('userBottomBar.muteMic')}
          >
            <MicOff size={14} />
          </button>
          <button
            className={`p-1 rounded ${muted ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'}`}
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
    </>
  );
};