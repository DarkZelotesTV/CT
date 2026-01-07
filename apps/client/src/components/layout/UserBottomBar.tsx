import { useMemo, useState, useCallback } from 'react';
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import { useVoice } from '../../features/voice';
import { storage } from '../../shared/config/storage';

export const UserBottomBar = ({ onOpenUserSettings }: { onOpenUserSettings?: () => void }) => {
  const { settings } = useSettings();
  const user = useMemo(() => storage.get('cloverUser'), []);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useTranslation();

  const { micMuted, muted, setMicMuted, setMuted, connectionState } = useVoice();
  const status = settings.profile.status ?? (user as any)?.status ?? (connectionState === 'connected' ? 'online' : 'offline');
  const normalizedStatus = status?.toLowerCase?.();
  const statusClass = status ? `status-pill ${normalizedStatus}` : 'status-pill';
  const statusDotClass = normalizedStatus || 'offline';
  const statusLabelMap: Record<string, string> = {
    online: t('userBottomBar.online', { defaultValue: 'Online' }),
    idle: t('userBottomBar.idle', { defaultValue: 'Idle' }),
    away: t('userBottomBar.idle', { defaultValue: 'Idle' }),
    dnd: t('userBottomBar.dnd', { defaultValue: 'Busy' }),
    offline: t('userBottomBar.offline', { defaultValue: 'Offline' }),
  };
  const statusLabel = statusLabelMap[status?.toLowerCase()] ?? status ?? t('userBottomBar.offline', { defaultValue: 'Offline' });

  const displayName = settings.profile.displayName || user?.username || t('userBottomBar.fallbackDisplayName');
  const avatarSrc = resolveServerAssetUrl(settings.profile.avatarUrl || (user as any)?.avatar_url || '');

  const toggleMic = useCallback(() => {
    void setMicMuted(!micMuted);
  }, [micMuted, setMicMuted]);

  const toggleMuted = useCallback(() => {
    void setMuted(!muted);
  }, [muted, setMuted]);

  const handleSettings = useCallback(() => {
    if (onOpenUserSettings) onOpenUserSettings();
    else setShowSettings(true);
  }, [onOpenUserSettings]);

  return (
    <>
      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-4)] border border-[color:var(--color-border)] bg-gradient-to-r from-black/40 via-[#0c0f14]/70 to-black/30 shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-[var(--radius-4)] overflow-hidden bg-[color:var(--color-surface-hover)]/80 flex items-center justify-center text-lg font-bold text-white">
              {avatarSrc ? (
                <img src={avatarSrc} className="w-full h-full object-cover" alt={`${displayName} Avatar`} />
              ) : (
                (displayName?.[0] ?? 'U').toUpperCase()
              )}
            </div>
            <span className={`status-dot badge ${statusDotClass}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm text-white font-semibold truncate">{displayName}</div>
            <div className={statusClass}>{statusLabel}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`h-10 w-10 rounded-[var(--radius-3)] border flex items-center justify-center transition-colors ${
                micMuted
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                  : 'bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]'
              }`}
              onClick={toggleMic}
              aria-pressed={micMuted}
              title={micMuted ? t('userBottomBar.unmuteMic') : t('userBottomBar.muteMic')}
            >
              {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              className={`h-10 w-10 rounded-[var(--radius-3)] border flex items-center justify-center transition-colors ${
                muted
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                  : 'bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]'
              }`}
              onClick={toggleMuted}
              aria-pressed={muted}
              title={muted ? t('userBottomBar.unmuteAll') : t('userBottomBar.muteAll')}
            >
              {muted ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
            </button>

            <button
              className="h-10 w-10 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-hover)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] transition-colors flex items-center justify-center"
              onClick={handleSettings}
              title={t('userBottomBar.settings')}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
};
