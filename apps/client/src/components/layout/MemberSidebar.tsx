import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Shield, Crown, UserCheck, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';
import { ErrorCard, Icon, Input, RoleTag, Select, Skeleton, Spinner } from '../ui';
import { Button } from '../ui/Button';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import './MemberSidebar.css';

type PresenceStatus = 'online' | 'idle' | 'offline' | 'dnd' | 'away';
type RowVariant = 'default' | 'connected' | 'afk' | 'offline';

export interface Member {
  userId: number;
  username: string;
  avatarUrl?: string;
  status: PresenceStatus;
  roles?: any[];
}

const normalizeStatus = (rawStatus: any): PresenceStatus => {
  const normalized = String(rawStatus ?? '').toLowerCase();
  if (['online', 'active'].includes(normalized)) return 'online';
  if (['idle', 'away'].includes(normalized)) return 'idle';
  if (['dnd', 'busy'].includes(normalized)) return 'dnd';
  return 'offline';
};

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

  const statusClass = (() => {
    if (member.status === 'online') return 'online';
    if (member.status === 'idle' || member.status === 'away') return 'idle';
    if (member.status === 'dnd') return 'dnd';
    return 'offline';
  })();

  return (
    <div className="ct-member-sidebar__avatar" aria-label={finalStatusLabel}>
      <span className={`ct-member-sidebar__status-ring ct-member-sidebar__status-ring--${statusClass}`} aria-hidden />
      {member.avatarUrl ? (
        <img src={resolveServerAssetUrl(member.avatarUrl)} alt={finalAvatarAlt} />
      ) : (
        <span className="ct-member-sidebar__avatar-initial" aria-label={initialsLabel}>
          {avatarInitial}
        </span>
      )}
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
    status: normalizeStatus(payload.status ?? payload.User?.status ?? payload.user?.status ?? 'offline'),
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

  const voiceChannelLookup = useMemo(() => {
    const lookup = new Map<number, string>();
    voiceChannels.forEach((vc) => lookup.set(vc.id, vc.name));
    return lookup;
  }, [voiceChannels]);

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

    const handleStatusChange = ({ userId, status }: { userId: number; status: PresenceStatus }) => {
      const normalizedStatus = normalizeStatus(status);
      setMembers((prev) => prev.map((member) => (member.userId === userId ? { ...member, status: normalizedStatus } : member)));
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
    setMembers((prev) =>
      prev.map((member) => {
        const snapshot = presenceSnapshot[member.userId];
        if (!snapshot) return member;
        const snapshotAvatar =
          getAvatarUrl(snapshot.avatar) || getAvatarUrl(snapshot.avatar_url) || getAvatarUrl(snapshot.avatarUrl) || member.avatarUrl;
        return {
          ...member,
          username: snapshot.username ?? member.username,
          ...(snapshotAvatar ? { avatarUrl: snapshotAvatar } : {}),
          status: normalizeStatus(snapshot.status ?? member.status),
        };
      })
    );
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
  const matchesSearch = useCallback((member: Member) => {
    if (!normalizedSearch) return true;
    return member.username.toLowerCase().includes(normalizedSearch);
  }, [normalizedSearch]);

  const filteredMembers = normalizedSearch ? members.filter(matchesSearch) : members;

  const membersById = useMemo(() => {
    const lookup = new Map<number, Member>();
    members.forEach((m) => lookup.set(m.userId, m));
    return lookup;
  }, [members]);

  const resolveVoiceMember = useCallback(
    (user: { id: number; username?: string; avatar_url?: string; status?: PresenceStatus }): Member => {
      const baseMember = membersById.get(user.id);
      const mergedStatus = normalizeStatus(user.status ?? baseMember?.status ?? 'online');
      const mergedAvatar = getAvatarUrl(user.avatar_url) ?? baseMember?.avatarUrl;

      if (baseMember) {
        return {
          ...baseMember,
          status: mergedStatus,
          ...(mergedAvatar ? { avatarUrl: mergedAvatar } : {}),
        };
      }

      return {
        userId: user.id,
        username: user.username ?? t('memberSidebar.unknownUser'),
        status: mergedStatus,
        ...(mergedAvatar ? { avatarUrl: mergedAvatar } : {}),
        roles: [],
      };
    },
    [membersById, t]
  );

  const isAfkStatus = (status: PresenceStatus) => status === 'idle' || status === 'away';

  type MemberRow =
    | { type: 'section'; key: string; label: string; count: number; variant?: RowVariant }
    | { type: 'member'; key: string; member: Member; variant?: RowVariant };

  const memberRows = useMemo<MemberRow[]>(() => {
    const rows: MemberRow[] = [];
    const connectedIds = new Set<number>();

    const voiceEntries = Object.entries(channelPresence || {});
    const orderedChannelIds = voiceChannels.map((vc) => vc.id);
    const sortedVoiceEntries = voiceEntries.sort(([a], [b]) => {
      const aId = Number(a);
      const bId = Number(b);
      const aIndex = orderedChannelIds.indexOf(aId);
      const bIndex = orderedChannelIds.indexOf(bId);
      if (aIndex === -1 || bIndex === -1) return aId - bId;
      return aIndex - bIndex;
    });

    sortedVoiceEntries.forEach(([channelIdRaw, users]) => {
      const channelId = Number(channelIdRaw);
      const membersInChannel = (users || []).map(resolveVoiceMember).filter(matchesSearch);
      if (membersInChannel.length === 0) return;

      membersInChannel.forEach((m) => connectedIds.add(m.userId));

      const channelLabel = voiceChannelLookup.get(channelId) ?? t('memberSidebar.unknownChannel', { channelId });
      rows.push({
        type: 'section',
        key: `voice-${channelId}`,
        label: t('memberSidebar.connectedTo', { channel: channelLabel }),
        count: membersInChannel.length,
        variant: 'connected',
      });
      membersInChannel.forEach((member) =>
        rows.push({ type: 'member', key: `voice-${channelId}-member-${member.userId}`, member, variant: 'connected' })
      );
    });

    const nonVoiceMembers = filteredMembers.filter((m) => !connectedIds.has(m.userId));
    const afkMembers = nonVoiceMembers.filter((m) => isAfkStatus(m.status));
    const offlineMembers = nonVoiceMembers.filter((m) => normalizeStatus(m.status) === 'offline');
    const onlineMembers = nonVoiceMembers.filter((m) => !isAfkStatus(m.status) && normalizeStatus(m.status) !== 'offline');

    if (onlineMembers.length > 0) {
      rows.push({ type: 'section', key: 'online', label: t('memberSidebar.online'), count: onlineMembers.length });
      rows.push(...onlineMembers.map<MemberRow>((member) => ({ type: 'member', key: `member-${member.userId}`, member })));
    }

    if (afkMembers.length > 0) {
      rows.push({ type: 'section', key: 'afk', label: t('memberSidebar.afk'), count: afkMembers.length, variant: 'afk' });
      rows.push(
        ...afkMembers.map<MemberRow>((member) => ({ type: 'member', key: `afk-${member.userId}`, member, variant: 'afk' }))
      );
    }

    if (offlineMembers.length > 0) {
      rows.push({
        type: 'section',
        key: 'offline',
        label: t('memberSidebar.offline'),
        count: offlineMembers.length,
        variant: 'offline',
      });
      rows.push(
        ...offlineMembers.map<MemberRow>((member) => ({ type: 'member', key: `member-${member.userId}`, member, variant: 'offline' }))
      );
    }

    return rows;
  }, [channelPresence, filteredMembers, matchesSearch, resolveVoiceMember, t, voiceChannelLookup, voiceChannels]);

  const memberVirtualizer = useVirtualizer({
    count: memberRows.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: (index: number) => (memberRows[index]?.type === 'section' ? 32 : 110),
    overscan: 8,
  });

  const renderMember = (m: Member, variant: RowVariant = 'default', style?: CSSProperties) => {
    const statusClass = m.status === 'idle' || m.status === 'away' ? 'idle' : m.status;
    const statusTone =
      statusClass === 'online'
        ? { row: 'ct-member-sidebar__row ct-member-sidebar__row--status-online' }
        : statusClass === 'idle'
          ? { row: 'ct-member-sidebar__row ct-member-sidebar__row--status-idle' }
          : statusClass === 'dnd'
            ? { row: 'ct-member-sidebar__row ct-member-sidebar__row--status-dnd' }
            : { row: 'ct-member-sidebar__row ct-member-sidebar__row--status-offline' };

    const variantClass =
      variant === 'connected'
        ? 'ct-member-sidebar__row--accent-connected'
        : variant === 'afk'
          ? 'ct-member-sidebar__row--accent-afk'
          : variant === 'offline'
            ? 'ct-member-sidebar__row--accent-offline'
            : '';

    const roleTags = (m.roles || [])
      .map((role: any) => (typeof role === 'string' ? role : role?.name))
      .filter(Boolean)
      .map((role: string) => role.toLowerCase());

    const roleBadges = [
      roleTags.includes('owner') ? { label: 'Owner', icon: Crown, variant: 'admin' } : null,
      roleTags.includes('admin') ? { label: 'Admin', icon: Shield, variant: 'admin' } : null,
      roleTags.some((r) => r.includes('mod')) ? { label: 'Mod', icon: Shield, variant: 'mod' } : null,
      roleTags.some((r) => r.includes('bot')) ? { label: 'Bot', icon: UserCheck, variant: 'bot' } : null,
    ].filter(Boolean) as { label: string; icon: typeof Shield; variant: 'admin' | 'mod' | 'bot' }[];

    const statusText =
      m.status === 'online'
        ? t('memberSidebar.onlineStatus')
        : m.status === 'idle' || m.status === 'away'
          ? t('memberSidebar.idleStatus', { defaultValue: 'Abwesend' })
          : m.status === 'dnd'
            ? t('memberSidebar.busyStatus', { defaultValue: 'Beschäftigt' })
            : t('memberSidebar.offlineStatus');

    return (
      <div
        key={m.userId}
        style={style}
        className={`${statusTone.row} ${variantClass} cursor-pointer`}
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

        <div className="ct-member-sidebar__body">
          <div className="ct-member-sidebar__title-row">
            <span className="ct-member-sidebar__name">{m.username}</span>
          </div>
          <div className="m-stat-row flex items-center gap-2 flex-wrap">
            <span className={`ct-member-sidebar__stat ct-member-sidebar__stat--${statusClass}`}>{statusText}</span>
          </div>
          <div className="ct-member-sidebar__roles">
            {roleBadges.length === 0 && (
              <RoleTag variant="neutral">
                <Icon icon={UserX} size="sm" tone="default" className="text-inherit" />{' '}
                {t('memberSidebar.noRoles', { defaultValue: 'Keine Rollen' })}
              </RoleTag>
            )}
            {roleBadges.map((badge) => {
              const BadgeIcon = badge.icon;
              return (
                <RoleTag key={`${m.userId}-${badge.label}`} variant={badge.variant}>
                  <Icon icon={BadgeIcon} size="sm" tone="default" className="text-inherit" /> {badge.label}
                </RoleTag>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ct-member-sidebar overflow-hidden">
      <div className="ct-member-sidebar__header">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('memberSidebar.searchPlaceholder') ?? ''}
          className="ct-member-sidebar__search"
        />
      </div>

      <div ref={listParentRef} className="ct-member-sidebar__list custom-scrollbar">
        {loading && (
          <div className="space-y-3">
            <Spinner label={t('memberSidebar.loading')} />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <div key={`member-skeleton-${index}`} className="ct-member-sidebar__row">
                  <Skeleton className="h-[46px] w-[46px] rounded-[var(--radius-3)] bg-[var(--color-surface-hover)]" />
                  <div className="ct-member-sidebar__body">
                    <Skeleton className="h-3 w-1/3 bg-[var(--color-surface-hover)]" />
                    <Skeleton className="h-2.5 w-1/2 bg-[var(--color-surface-hover)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="px-1">
            <ErrorCard message={error} retryLabel={t('memberSidebar.retry') ?? undefined} onRetry={() => fetchMembers()} />
          </div>
        )}

        {!loading && !error && filteredMembers.length === 0 && (
          <div className="px-1 text-xs text-[color:var(--color-text-muted)]">{t('memberSidebar.empty')}</div>
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
                    className={`ct-member-sidebar__group-header ${row.variant ? `ct-member-sidebar__group-header--${row.variant}` : ''}`}
                  >
                    <span>{row.label}</span>
                    <span className="ct-member-sidebar__group-count">{row.count}</span>
                  </div>
                );
              }

              return renderMember(row.member, row.variant, style);
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
              <Button
                type="button"
                variant="ghost"
                className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                onClick={() => performModeration('mute', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.mute')}
              </Button>
            ) : null}
            {canActOnVoice ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                onClick={() => performModeration('remove', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.removeFromTalk')}
              </Button>
            ) : null}
            {canActOnVoice && voiceChannels.length > 1 ? (
              <div className="px-2 py-1 space-y-1">
                <div className="text-[11px] text-[color:var(--color-text-muted)]">{t('memberSidebar.moveToTalk')}</div>
                <div className="flex items-center gap-2">
                  <Select
                    className="flex-1 bg-[var(--color-surface-alt)] text-sm text-[color:var(--color-text)]"
                    value={contextMenu.moveTargetId || ''}
                    onChange={(e) => setContextMenu((prev) => (prev ? { ...prev, moveTargetId: Number(e.target.value) } : prev))}
                  >
                    {voiceChannels
                      .filter((vc) => vc.id !== contextMenu.channelId)
                      .map((vc) => (
                        <option key={vc.id} value={vc.id}>{vc.name}</option>
                      ))}
                  </Select>
                  <Button
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
                  </Button>
                </div>
              </div>
            ) : null}
            {canModerateMember ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                  onClick={() => performModeration('ban', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.ban')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] text-sm text-[color:var(--color-text)]"
                  onClick={() => performModeration('kick', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.kick')}
                </Button>
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
