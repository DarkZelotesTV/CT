import { useMemo, useState, useCallback } from 'react';
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import { useVoice } from '../../features/voice';
import { storage } from '../../shared/config/storage';
import { Avatar, Icon, StatusBadge, type AvatarStatus, type StatusTone } from '../ui';
import { IconButton } from '../ui/Button';

export const UserBottomBar = ({ onOpenUserSettings }: { onOpenUserSettings?: () => void }) => {
  const { settings } = useSettings();
  const user = useMemo(() => storage.get('cloverUser'), []);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useTranslation();

  const { micMuted, muted, setMicMuted, setMuted, connectionState } = useVoice();
  const status = settings.profile.status ?? (user as any)?.status ?? (connectionState === 'connected' ? 'online' : 'offline');
  const normalizedStatus = status?.toLowerCase?.();
  const statusTone = (() => {
    if (normalizedStatus === 'online') return 'online';
    if (normalizedStatus === 'idle' || normalizedStatus === 'away') return 'idle';
    if (normalizedStatus === 'dnd' || normalizedStatus === 'busy') return 'dnd';
    return 'offline';
  })() as StatusTone;
  const avatarStatus = (() => {
    if (normalizedStatus === 'online' || normalizedStatus === 'live' || normalizedStatus === 'ready') return 'online';
    if (normalizedStatus === 'idle' || normalizedStatus === 'away' || normalizedStatus === 'paused') return 'idle';
    if (normalizedStatus === 'dnd' || normalizedStatus === 'busy') return 'dnd';
    return 'offline';
  })() as AvatarStatus;
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
          <Avatar
            size="xl"
            shape="rounded"
            status={avatarStatus}
            src={avatarSrc || undefined}
            alt={`${displayName} Avatar`}
            fallback={(displayName?.[0] ?? 'U').toUpperCase()}
          />

          <div className="min-w-0 flex-1">
            <div className="text-sm text-text font-semibold truncate">{displayName}</div>
            <StatusBadge status={statusTone}>{statusLabel}</StatusBadge>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              className={`h-10 w-10 rounded-[var(--radius-3)] border flex items-center justify-center transition-colors ${
                micMuted
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                  : 'bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]'
              }`}
              onClick={toggleMic}
              aria-pressed={micMuted}
              aria-label={micMuted ? t('userBottomBar.unmuteMic') : t('userBottomBar.muteMic')}
              title={micMuted ? t('userBottomBar.unmuteMic') : t('userBottomBar.muteMic')}
            >
              {micMuted ? (
                <Icon icon={MicOff} size="md" tone="default" className="text-inherit" />
              ) : (
                <Icon icon={Mic} size="md" tone="default" className="text-inherit" />
              )}
            </IconButton>

            <IconButton
              className={`h-10 w-10 rounded-[var(--radius-3)] border flex items-center justify-center transition-colors ${
                muted
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                  : 'bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]'
              }`}
              onClick={toggleMuted}
              aria-pressed={muted}
              aria-label={muted ? t('userBottomBar.unmuteAll') : t('userBottomBar.muteAll')}
              title={muted ? t('userBottomBar.unmuteAll') : t('userBottomBar.muteAll')}
            >
              {muted ? (
                <Icon icon={HeadphoneOff} size="md" tone="default" className="text-inherit" />
              ) : (
                <Icon icon={Headphones} size="md" tone="default" className="text-inherit" />
              )}
            </IconButton>

            <IconButton
              className="h-10 w-10 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-hover)] text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] transition-colors flex items-center justify-center"
              onClick={handleSettings}
              aria-label={t('userBottomBar.settings')}
              title={t('userBottomBar.settings')}
            >
              <Icon icon={Settings} size="md" tone="default" className="text-inherit" />
            </IconButton>
          </div>
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
};
