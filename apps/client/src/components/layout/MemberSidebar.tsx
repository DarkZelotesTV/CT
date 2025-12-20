import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Shield, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';
import { ErrorCard, Skeleton, Spinner } from '../ui';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

export interface Member {
  userId: number;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline';
  roles?: any[];
}

export const MemberAvatar = ({
  member,
  avatarAlt,
  initialsLabel,
  statusLabel,
}: {
  member: Member;
  avatarAlt?: string;
  initialsLabel?: string;
  statusLabel?: (status: Member['status']) => string;
}) => {
  const avatarInitial = member.username?.[0]?.toUpperCase() ?? '?';
  const finalAvatarAlt = avatarAlt ?? `${member.username} avatar`;
  const finalStatusLabel = statusLabel?.(member.status) ?? `Status: ${member.status}`;

  return (
    <div className="mr-3 flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-glass-300 relative">
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={finalAvatarAlt} className="h-full w-full object-cover" />
      ) : (
        <span className="select-none text-xs font-bold text-gray-400" aria-label={initialsLabel}>
          {avatarInitial}
        </span>
      )}
      <span
        className={`pointer-events-none absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111214] ${
          member.status === 'online' ? 'bg-success' : 'bg-gray-500'
        }`}
        aria-label={finalStatusLabel}
      />
    </div>
  );
};

export const getAvatarUrl = (avatarPayload: any): string | undefined => {
  if (!avatarPayload) return undefined;

  if (typeof avatarPayload === 'string') return avatarPayload;

  if (typeof avatarPayload !== 'object') return undefined;

  if (typeof avatarPayload.url === 'string') return avatarPayload.url;
  if (typeof avatarPayload.avatar_url === 'string') return avatarPayload.avatar_url;

  const cdnKey = avatarPayload.cdnKey ?? avatarPayload.cdn_key;
  if (typeof cdnKey === 'string') return cdnKey;

  const variants =
    avatarPayload.variants || avatarPayload.imageVariants || avatarPayload.image_variants || avatarPayload.images;
  if (variants && typeof variants === 'object') {
    const preferredVariants = [variants.default, variants.avatar, variants.full];
    for (const candidate of preferredVariants) {
      const resolved = getAvatarUrl(candidate);
      if (resolved) return resolved;
    }

    for (const value of Object.values(variants)) {
      const resolved = getAvatarUrl(value);
      if (resolved) return resolved;
    }
  }

  const nestedCandidates = [avatarPayload.image, avatarPayload.avatar, avatarPayload.data];
  for (const candidate of nestedCandidates) {
    const resolved = getAvatarUrl(candidate);
    if (resolved) return resolved;
  }

  for (const value of Object.values(avatarPayload)) {
    const resolved = getAvatarUrl(value);
    if (resolved) return resolved;
  }

  return undefined;
};

export const normalizeMemberData = (payload: any, unknownUserLabel: string): Member => {
  const avatarSources = [
    payload.avatar,
    payload.avatarUrl,
    payload.avatar_url,
    payload.User?.avatar,
    payload.User?.avatar_url,
    payload.user?.avatar,
    payload.user?.avatar_url,
  ];

  const avatarUrl = avatarSources.map(getAvatarUrl).find(Boolean);

  return {
    userId: payload.userId ?? payload.user_id ?? payload.User?.id ?? payload.user?.id,
    username: payload.username ?? payload.User?.username ?? payload.user?.username ?? unknownUserLabel,
    ...(avatarUrl ? { avatarUrl } : {}),
    status: payload.status ?? payload.User?.status ?? payload.user?.status ?? 'offline',
    roles: payload.roles ?? (payload.role ? [payload.role] : []),
  };
};

export const MemberSidebar = ({ serverId }: { serverId: number }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [voiceChannels, setVoiceChannels] = useState<{ id: number; name: string }[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    userId: number;
    username: string;
    channelId: number | null;
    channelName?: string;
    x: number;
    y: number;
    target?: HTMLElement | null;
    moveTargetId?: number | null;
  } | null>(null);
  const { socket, presenceSnapshot, channelPresence } = useSocket();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { t } = useTranslation();
  const listParentRef = useRef<HTMLDivElement | null>(null);
  const canMoveMembers = Boolean(permissions.move);
  const canKickMembers = Boolean(permissions.kick);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const normalizeMember = useCallback((m: any): Member => normalizeMemberData(m, t('memberSidebar.unknownUser')), [t]);

  const fetchMembers = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<any[]>(`/api/servers/${serverId}/members`);
      if (!isMountedRef.current) return;
      setMembers(res.map(normalizeMember));
    } catch (err) {
      console.error('Fehler beim Laden der Member:', err);
      if (!isMountedRef.current) return;
      setError(t('memberSidebar.loadError'));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [normalizeMember, serverId, t]);

  const closeContextMenu = () => setContextMenu(null);

  const findActiveVoiceChannel = (userId: number) => {
    const entry = Object.entries(channelPresence || {}).find(([, users]) => (users || []).some((u) => u.id === userId));
    if (!entry) return null;
    const [channelId] = entry;
    const numericId = Number(channelId);
    const voiceChannel = voiceChannels.find((ch) => ch.id === numericId);
    return { channelId: numericId, channelName: voiceChannel?.name };
  };

  const openUserMenu = (
    origin: { x: number; y: number; target?: HTMLElement | null },
    member: Member
  ) => {
    const active = findActiveVoiceChannel(member.userId);
    setContextMenu({
      userId: member.userId,
      username: member.username,
      channelId: active?.channelId ?? null,
      ...(active?.channelName ? { channelName: active.channelName } : {}),
      x: origin.x,
      y: origin.y,
      target: origin.target ?? null,
      moveTargetId: active?.channelId ?? null,
    });
  };

  const startLongPress = (handler: () => void) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(handler, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const performModeration = async (
    action: 'mute' | 'kick' | 'ban' | 'remove' | 'move',
    payload: { userId: number; channelId?: number | null; targetChannelId?: number | null }
  ) => {
    if (!serverId) return;
    const canMove = Boolean(permissions.move);
    const canKick = Boolean(permissions.kick);
    const canActOnVoice = canMove && Boolean(payload.channelId);
    if (['mute', 'remove', 'move'].includes(action) && !canActOnVoice) {
      alert(t('memberSidebar.errors.missingPermissions'));
      return;
    }
    if ((action === 'kick' || action === 'ban') && !canKick) {
      alert(t('memberSidebar.errors.missingPermissions'));
      return;
    }
    try {
      switch (action) {
        case 'mute':
          if (!payload.channelId) throw new Error(t('memberSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'remove':
          if (!payload.channelId) throw new Error(t('memberSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/remove-from-talk`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'move':
          if (!payload.channelId || !payload.targetChannelId) throw new Error(t('memberSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/move`, {
            method: 'POST',
            body: JSON.stringify({ fromChannelId: payload.channelId, toChannelId: payload.targetChannelId }),
          });
          break;
        case 'ban':
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/ban`, { method: 'POST' });
          break;
        case 'kick':
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}`, { method: 'DELETE' });
          break;
      }
      if (action === 'ban' || action === 'kick') {
        setMembers((prev) => prev.filter((member) => member.userId !== payload.userId));
      }
    } catch (err: any) {
      alert(err?.message || t('memberSidebar.errors.actionFailed'));
    } finally {
      closeContextMenu();
    }
  };

  // --- API LOGIC: Mitglieder Laden ---
  useEffect(() => {
    if (!serverId) return;

    let isActive = true;

    if (socket) {
      setLoading(true);
      setError(null);
      socket.emit('request_server_members', { serverId });
      const fallbackTimer = setTimeout(() => {
        if (isActive) void fetchMembers();
      }, 5_000);

      return () => {
        isActive = false;
        clearTimeout(fallbackTimer);
      };
    }

    void fetchMembers();

    return () => {
      isActive = false;
    };
  }, [fetchMembers, serverId, socket]);

  useEffect(() => {
    if (!serverId) return;
    apiFetch<Record<string, boolean>>(`/api/servers/${serverId}/permissions`).then(setPermissions).catch(() => setPermissions({}));
  }, [serverId]);

  useEffect(() => {
    if (!serverId) return;
    apiFetch<{ categories: any[]; uncategorized: any[] }>(`/api/servers/${serverId}/structure`)
      .then((res) => {
        const channels = [...(res?.uncategorized || []), ...(res?.categories || []).flatMap((c: any) => c.channels || [])];
        setVoiceChannels(channels.filter((c: any) => c.type === 'voice').map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => setVoiceChannels([]));
  }, [serverId]);

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setMembers(prev => prev.map((member) => member.userId === userId ? { ...member, status } : member));
    };

    const handleMemberSnapshot = ({ serverId: incomingServerId, members: incomingMembers }: { serverId: number; members: any[] }) => {
      if (incomingServerId !== serverId) return;
      setMembers(incomingMembers.map(normalizeMember));
      setError(null);
      setLoading(false);
    };

    socket.on('user_status_change', handleStatusChange);
    socket.on('server_members_snapshot', handleMemberSnapshot);

    return () => {
      socket.off('user_status_change', handleStatusChange);
      socket.off('server_members_snapshot', handleMemberSnapshot);
    };
  }, [socket, serverId]);

  useEffect(() => {
    setMembers((prev) => prev.map((member) => {
      const snapshot = presenceSnapshot[member.userId];
      if (!snapshot) return member;
      const snapshotAvatar =
        getAvatarUrl(snapshot.avatar) || getAvatarUrl(snapshot.avatar_url) || getAvatarUrl(snapshot.avatarUrl) || member.avatarUrl;
      return {
        ...member,
        username: snapshot.username ?? member.username,
        ...(snapshotAvatar ? { avatarUrl: snapshotAvatar } : {}),
        status: snapshot.status ?? member.status,
      };
    }));
  }, [presenceSnapshot]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobal = (e: MouseEvent) => {
      if (!contextMenu.target) return closeContextMenu();
      if (!(contextMenu.target as HTMLElement).contains(e.target as HTMLElement)) closeContextMenu();
    };
    window.addEventListener('click', handleGlobal);
    window.addEventListener('contextmenu', handleGlobal);
    return () => {
      window.removeEventListener('click', handleGlobal);
      window.removeEventListener('contextmenu', handleGlobal);
    };
  }, [contextMenu]);

  const targetMember = useMemo(
    () => (contextMenu ? members.find((m) => m.userId === contextMenu.userId) ?? null : null),
    [contextMenu, members]
  );
  const targetIsProtected = Boolean(targetMember?.roles?.some((r: any) => r.name === 'owner'));
  const canActOnVoice = Boolean(contextMenu?.channelId) && canMoveMembers && !targetIsProtected;
  const canModerateMember = canKickMembers && !targetIsProtected;
  const hasContextActions = canActOnVoice || canModerateMember;

  useEffect(() => {
    if (!contextMenu?.channelId) return;
    const nextOption = voiceChannels.find((vc) => vc.id !== contextMenu.channelId);
    if (!nextOption) return;
    setContextMenu((prev) => (prev ? { ...prev, moveTargetId: prev.moveTargetId || nextOption.id } : prev));
  }, [contextMenu?.channelId, voiceChannels]);

  const normalizedSearch = debouncedSearch.toLowerCase();
  const filteredMembers = normalizedSearch
    ? members.filter((m) => m.username.toLowerCase().includes(normalizedSearch))
    : members;

  // Gruppenlogik (Online / Offline)
  const onlineMembers = filteredMembers.filter((m) => m.status === 'online');
  const offlineMembers = filteredMembers.filter((m) => m.status !== 'online');

  type MemberRow =
    | { type: 'section'; key: string; label: string; count: number }
    | { type: 'member'; key: string; member: Member };

  const memberRows = useMemo<MemberRow[]>(() => {
    const rows: MemberRow[] = [
      { type: 'section' as const, key: 'online', label: t('memberSidebar.online'), count: onlineMembers.length },
      ...onlineMembers.map((member) => ({ type: 'member' as const, key: `member-${member.userId}`, member })),
      { type: 'section' as const, key: 'offline', label: t('memberSidebar.offline'), count: offlineMembers.length },
      ...offlineMembers.map((member) => ({ type: 'member' as const, key: `member-${member.userId}`, member })),
    ];

    return rows;
  }, [offlineMembers, onlineMembers, t]);

  const memberVirtualizer = useVirtualizer({
    count: memberRows.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: (index: number) => (memberRows[index]?.type === 'section' ? 32 : 72),
    overscan: 8,
  });

  const renderMember = (m: Member, style?: CSSProperties) => (
    <div
      key={m.userId}
      style={style}
      className="flex items-center p-2 mb-1 rounded-lg hover:bg-white/5 cursor-pointer group transition-all"
      onContextMenu={(e) => {
        e.preventDefault();
        openUserMenu({ x: e.clientX, y: e.clientY, target: e.currentTarget as HTMLElement }, m);
      }}
      onTouchStart={(e) => {
        const touch = e.touches?.[0];
        startLongPress(() =>
          openUserMenu({ x: touch?.clientX || 0, y: touch?.clientY || 0, target: e.currentTarget as HTMLElement }, m)
        );
      }}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <MemberAvatar
        member={m}
        avatarAlt={t('memberSidebar.avatarAlt', { username: m.username }) ?? `${m.username} avatar`}
        initialsLabel={t('memberSidebar.initialsAvatar') ?? undefined}
        statusLabel={(status) => t('memberSidebar.statusLabel', { status }) ?? `Status: ${status}`}
      />

      <div className="overflow-hidden">
        <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate flex items-center gap-1">
          {m.username}
          {m.roles?.some((r: any) => r.name === 'owner') && <Crown size={12} className="text-yellow-500 fill-yellow-500/20" />}
          {m.roles?.some((r: any) => r.name === 'admin') && <Shield size={12} className="text-primary fill-primary/20" />}
        </div>
        {/* Custom Status Text (Dummy für jetzt) */}
        <div className="text-[10px] text-gray-500 truncate group-hover:text-gray-400">
          {m.status === 'online' ? t('memberSidebar.onlineStatus') : t('memberSidebar.offlineStatus')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-black tracking-widest text-gray-500 uppercase">{t('memberSidebar.header')}</span>
        <span className="ml-auto text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{filteredMembers.length}</span>
      </div>

      <div ref={listParentRef} className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-6">
          <div className="px-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('memberSidebar.searchPlaceholder') ?? ''}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {loading && (
            <div className="space-y-3 px-2">
              <Spinner label={t('memberSidebar.loading')} />
              <div className="space-y-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={`member-skeleton-${index}`} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-[var(--color-surface-hover)]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3 bg-[var(--color-surface-hover)]" />
                      <Skeleton className="h-2.5 w-1/4 bg-[var(--color-surface-hover)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="px-2">
              <ErrorCard
                message={error}
                retryLabel={t('memberSidebar.retry') ?? undefined}
                onRetry={() => fetchMembers()}
              />
            </div>
          )}

          {!loading && !error && filteredMembers.length === 0 && (
            <div className="px-2 text-xs text-[color:var(--color-text-muted)]">{t('memberSidebar.empty')}</div>
          )}

          {!loading && !error && filteredMembers.length > 0 && (
            <div style={{ height: memberVirtualizer.getTotalSize(), position: 'relative' }}>
              {memberVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
                const row = memberRows[virtualRow.index];
                if (!row) return null;

                const style: CSSProperties = {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                };

                if (row.type === 'section') {
                  return (
                    <div
                      key={row.key}
                      style={style}
                      className="text-[10px] font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider flex items-center gap-2"
                    >
                      {row.label} <span className="text-[9px] text-gray-600">— {row.count}</span>
                    </div>
                  );
                }

                return renderMember(row.member, style);
              })}
            </div>
          )}
      </div>

      {contextMenu && (
        <div className="fixed left-0 right-0 bottom-0 top-[var(--ct-titlebar-height)] z-50" onClick={closeContextMenu}>
          <div
            className="absolute min-w-[240px] rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-2 space-y-1"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] text-[color:var(--color-text-muted)] uppercase tracking-wide px-2 pb-1">{contextMenu.username}</div>
            {canActOnVoice ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                onClick={() => performModeration('mute', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.mute')}
              </button>
            ) : null}
            {canActOnVoice ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                onClick={() => performModeration('remove', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.removeFromTalk')}
              </button>
            ) : null}
            {canActOnVoice && voiceChannels.length > 1 ? (
              <div className="px-2 py-1 space-y-1">
                <div className="text-[11px] text-[color:var(--color-text-muted)]">{t('memberSidebar.moveToTalk')}</div>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[color:var(--color-text)]"
                    value={contextMenu.moveTargetId || ''}
                    onChange={(e) => setContextMenu((prev) => (prev ? { ...prev, moveTargetId: Number(e.target.value) } : prev))}
                  >
                    {voiceChannels
                      .filter((vc) => vc.id !== contextMenu.channelId)
                      .map((vc) => (
                        <option key={vc.id} value={vc.id}>{vc.name}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="px-2 py-1 rounded bg-[var(--color-accent)]/15 text-[color:var(--color-text)] text-sm hover:bg-[var(--color-accent)]/25"
                    disabled={!contextMenu.moveTargetId}
                    onClick={() =>
                      performModeration('move', {
                        userId: contextMenu.userId,
                        channelId: contextMenu.channelId!,
                        targetChannelId: contextMenu.moveTargetId ?? null,
                      })
                    }
                  >
                    {t('memberSidebar.move')}
                  </button>
                </div>
              </div>
            ) : null}
            {canModerateMember ? (
              <>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                  onClick={() => performModeration('ban', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.ban')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                  onClick={() => performModeration('kick', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.kick')}
                </button>
              </>
            ) : null}
            {!hasContextActions && (
              <div className="text-xs text-[color:var(--color-text-muted)] px-2 py-1">{t('memberSidebar.noActions')}</div>
            )}
          </div>
        </div>
      )}
  </div>
);
};
