import { useState, useEffect, useRef } from 'react';
import { Shield, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';

interface Member {
  userId: number;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline';
  roles?: any[];
}

export const MemberSidebar = ({ serverId }: { serverId: number }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const normalizeMember = (m: any): Member => ({
    userId: m.userId ?? m.user_id ?? m.User?.id ?? m.user?.id,
    username: m.username ?? m.User?.username ?? m.user?.username ?? t('memberSidebar.unknownUser'),
    avatarUrl: m.avatarUrl ?? m.avatar_url ?? m.User?.avatar_url ?? m.user?.avatar_url,
    status: m.status ?? m.User?.status ?? m.user?.status ?? 'offline',
    roles: m.roles ?? (m.role ? [m.role] : []),
  });

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
    if (!permissions.move && !permissions.kick) return;
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
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<any[]>(`/api/servers/${serverId}/members`);
        if (isActive) setMembers(res.map(normalizeMember));
      } catch (err) {
        console.error("Fehler beim Laden der Member:", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    if (socket) {
      socket.emit('request_server_members', { serverId });
      const fallbackTimer = setTimeout(() => {
        if (isActive) fetchMembers();
      }, 5_000);

      return () => {
        isActive = false;
        clearTimeout(fallbackTimer);
      };
    }

    fetchMembers();

    return () => {
      isActive = false;
    };
  }, [serverId, socket]);

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
      const avatarUrl = snapshot.avatar_url ?? member.avatarUrl;
      return {
        ...member,
        username: snapshot.username ?? member.username,
        ...(avatarUrl ? { avatarUrl } : {}),
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

  const renderMember = (m: Member) => (
      <div
        key={m.userId}
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
          <div className="w-9 h-9 rounded-full bg-glass-300 mr-3 relative flex items-center justify-center flex-shrink-0">
              {m.avatarUrl ? (
                  <img src={m.avatarUrl} className="w-full h-full rounded-full object-cover" />
              ) : (
                  <span className="font-bold text-gray-400 text-xs">{m.username?.[0]?.toUpperCase()}</span>
              )}

              {/* Status Dot */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111214]
                  ${m.status === 'online' ? 'bg-success' : 'bg-gray-500'}`}>
              </div>
          </div>

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

      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-6">
          <div className="px-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('memberSidebar.searchPlaceholder') ?? ''}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {/* Online Group */}
          <div>
              <div className="text-[10px] font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider flex items-center gap-2">
                 {t('memberSidebar.online')} <span className="text-[9px] text-gray-600">— {onlineMembers.length}</span>
              </div>
              {onlineMembers.map(renderMember)}
          </div>

          {/* Offline Group */}
           <div>
              <div className="text-[10px] font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider flex items-center gap-2">
                 {t('memberSidebar.offline')} <span className="text-[9px] text-gray-600">— {offlineMembers.length}</span>
              </div>
              {offlineMembers.map(renderMember)}
          </div>
      </div>

      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={closeContextMenu}>
          <div
            className="absolute min-w-[240px] rounded-md bg-[#16181d] border border-white/10 shadow-xl p-2 space-y-1"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] text-gray-400 uppercase tracking-wide px-2 pb-1">{contextMenu.username}</div>
            {permissions.move && contextMenu.channelId ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                onClick={() => performModeration('mute', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.mute')}
              </button>
            ) : null}
            {permissions.move && contextMenu.channelId ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                onClick={() => performModeration('remove', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
              >
                {t('memberSidebar.removeFromTalk')}
              </button>
            ) : null}
            {permissions.move && contextMenu.channelId && voiceChannels.length > 1 ? (
              <div className="px-2 py-1 space-y-1">
                <div className="text-[11px] text-gray-500">{t('memberSidebar.moveToTalk')}</div>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 bg-[#0f1115] border border-white/10 rounded px-2 py-1 text-sm text-gray-200"
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
                    className="px-2 py-1 rounded bg-primary/20 text-primary text-sm hover:bg-primary/30"
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
            {permissions.kick ? (
              <>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('ban', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.ban')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('kick', { userId: contextMenu.userId })}
                >
                  {t('memberSidebar.kick')}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
  </div>
);
};
