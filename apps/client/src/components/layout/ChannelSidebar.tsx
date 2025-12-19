import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Hash, Volume2, Settings, Plus, ChevronDown, ChevronRight, Globe, Mic, PhoneOff, Camera, ScreenShare, Lock, ListChecks, X } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { UserBottomBar } from './UserBottomBar';
import { useVoice } from '../../context/voice-state';
import { VoiceParticipantsPanel } from "../voice/VoiceParticipantsPanel";
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext'; // Für aktuellen DisplayName
import { defaultServerTheme, deriveServerThemeFromSettings, type ServerTheme } from '../../theme/serverTheme';

interface Channel { id: number; name: string; type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list'; custom_icon?: string; }
interface Category { id: number; name: string; channels: Channel[]; }
interface ChannelSidebarProps {
  serverId: number | null;
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenServerSettings: () => void;
  onCloseMobileNav?: () => void;
  onResolveFallback?: (channel: Channel | null) => void;
  refreshKey?: number;
}

export const ChannelSidebar = ({ serverId, activeChannelId, onSelectChannel, onOpenServerSettings, onCloseMobileNav, onResolveFallback, refreshKey = 0 }: ChannelSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('Server');
  const [serverTheme, setServerTheme] = useState<ServerTheme>(defaultServerTheme);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<Channel['type']>('text');
  const [createCategoryId, setCreateCategoryId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
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
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // CONTEXTS
  const { settings } = useSettings();
  const {
    activeRoom,
    activeChannelId: voiceChannelId,
    connectionState,
    activeChannelName,
    disconnect,
    isCameraEnabled,
    isScreenSharing,
    toggleCamera,
    toggleScreenShare,
    cameraError,
    screenShareError,
    isPublishingCamera,
    isPublishingScreen,
  } = useVoice();
  const { channelPresence } = useSocket();

  // Lokalen User laden (für ID-Vergleich)
  const localUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('clover_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const voiceChannels = useMemo(
    () =>
      [...uncategorized, ...categories.flatMap((cat) => cat.channels)]
        .filter((ch) => ch.type === 'voice')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, uncategorized]
  );

  const participantCount = activeRoom ? activeRoom.numParticipants : 0;
  const shouldShowVoiceParticipants = connectionState === 'connected' && participantCount > 0;

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    try {
      const srvRes = await apiFetch<any[]>(`/api/servers`);
      const current = srvRes.find((s: any) => s.id === serverId);
      if (current) {
        setServerName(current.name);
        setServerTheme(deriveServerThemeFromSettings(current.settings || current.theme));
      }
      const structRes = await apiFetch<{ categories: Category[]; uncategorized: Channel[]; fallbackChannelId?: number | null }>(`/api/servers/${serverId}/structure`);
      setCategories(structRes.categories);
      setUncategorized(structRes.uncategorized);

      const allChannels = [...structRes.uncategorized, ...structRes.categories.flatMap((c) => c.channels)];
      const fallbackChannel =
        allChannels.find((c) => c.id === (structRes.fallbackChannelId ?? null) && c.type !== 'voice' && c.type !== 'spacer') ||
        allChannels.find((c) => c.type !== 'voice' && c.type !== 'spacer') ||
        null;

      onResolveFallback?.(fallbackChannel ?? null);

      if (!activeChannelId && fallbackChannel) {
        onSelectChannel(fallbackChannel);
      }
    } catch (e) {}
  }, [activeChannelId, onResolveFallback, onSelectChannel, refreshKey, serverId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!serverId) return;
    apiFetch<Record<string, boolean>>(`/api/servers/${serverId}/permissions`).then(setPermissions).catch(() => setPermissions({}));
  }, [serverId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (!contextMenu.target) return closeContextMenu();
      if (!(contextMenu.target as HTMLElement).contains(e.target as HTMLElement)) {
        closeContextMenu();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu?.channelId) return;
    const nextOption = voiceChannels.find((vc) => vc.id !== contextMenu.channelId);
    if (!nextOption) return;
    setContextMenu((prev) => (prev ? { ...prev, moveTargetId: prev.moveTargetId || nextOption.id } : prev));
  }, [contextMenu?.channelId, voiceChannels]);

  const handleChannelClick = (c: Channel) => {
    if (c.type === 'spacer') return;
    onSelectChannel(c);
  };

  const closeContextMenu = () => setContextMenu(null);

  const openUserMenu = (
    origin: { x: number; y: number; target?: HTMLElement | null },
    user: any,
    channel?: Channel | null
  ) => {
    if (!permissions.move && !permissions.kick) return;
    setContextMenu({
      userId: user.id,
      username: user.username,
      channelId: channel?.id ?? null,
      channelName: channel?.name,
      x: origin.x,
      y: origin.y,
      target: origin.target,
      moveTargetId: channel?.id ?? null,
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
          if (!payload.channelId) throw new Error('Kein Kanal angegeben');
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'remove':
          if (!payload.channelId) throw new Error('Kein Kanal angegeben');
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/remove-from-talk`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'move':
          if (!payload.channelId || !payload.targetChannelId) throw new Error('Kanal fehlt');
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
    } catch (err: any) {
      alert(err?.message || 'Aktion fehlgeschlagen');
    } finally {
      closeContextMenu();
      fetchData();
    }
  };

  const renderChannel = (c: Channel, isInside: boolean) => {
    if (c.type === 'spacer') {
      return (
        <div key={c.id} className={`${isInside ? 'ml-4' : 'mx-2'} my-2 flex items-center gap-2`}>
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 select-none">Separator</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      );
    }

    const Icon =
      c.type === 'web'
        ? Globe
        : c.type === 'voice'
        ? Volume2
        : c.type === 'data-transfer'
        ? Lock
        : c.type === 'list'
        ? ListChecks
        : Hash;
    
    const isActive = activeChannelId === c.id;
    // Visuelle Indikation: Grüner Text, wenn ICH hier verbunden bin
    const isConnected = c.type === 'voice' && voiceChannelId === c.id && connectionState === 'connected';

    // --- OPTIMISTISCHE TEILNEHMER-LISTE ---
    // Start mit der Liste vom Server
    let displayParticipants = [...(channelPresence[c.id] || [])];
    const localUserId = localUser?.id ? String(localUser.id) : null;

    if (localUserId && c.type === 'voice') {
        const isMeConnectedHere = connectionState === 'connected' && voiceChannelId === c.id;
        const amIInList = displayParticipants.some(u => String(u.id) === localUserId);

        if (isMeConnectedHere && !amIInList) {
            // FIX: Ich bin verbunden, aber der Server hat mich noch nicht geschickt -> Füge mich optimistisch hinzu
            displayParticipants.push({
                id: Number(localUserId),
                username: settings.profile.displayName || localUser.username || 'Ich',
                avatar_url: settings.profile.avatarUrl || localUser.avatar_url,
                status: 'online'
            });
        } else if (!isMeConnectedHere && amIInList) {
            // FIX: Ich bin NICHT mehr verbunden, aber der Server listet mich noch -> Entferne mich sofort
            displayParticipants = displayParticipants.filter(u => String(u.id) !== localUserId);
        }
    }

    const hasPresence = displayParticipants.length > 0;

    return (
      <div key={c.id} className="relative">
        <div
          onClick={() => handleChannelClick(c)}
          className={`flex items-center no-drag px-2 py-1.5 mb-0.5 cursor-pointer group select-none rounded-md transition-colors
            ${isInside ? 'ml-4' : 'mx-2'}
            ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}
          `}
        >
          <Icon size={16} className={`mr-2 ${isConnected ? 'text-green-500' : ''}`} />
          <span className={`text-sm truncate flex-1 font-medium ${isConnected ? 'text-green-400' : ''}`}>{c.name}</span>
        </div>

        {c.type === 'voice' && hasPresence && (
          <div className={`${isInside ? 'ml-8' : 'ml-6'} mr-2 mb-1 rounded-md border border-white/5 bg-white/5 px-2 py-1.5 animate-in slide-in-from-top-1 duration-200`}>
            <div className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1 font-bold flex items-center gap-1">
               Im Kanal
            </div>
            <div className="space-y-1">
                {displayParticipants.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 text-xs text-gray-200 group/user"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openUserMenu({ x: e.clientX, y: e.clientY, target: e.currentTarget as HTMLElement }, user, c);
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches?.[0];
                      startLongPress(() =>
                        openUserMenu(
                          { x: touch?.clientX || 0, y: touch?.clientY || 0, target: e.currentTarget as HTMLElement },
                          user,
                          c
                        )
                      );
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    <div className="relative">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                        ) : (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${user.status === 'online' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                {user.username?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#1e1f22] ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    </div>
                    
                    <span className={`font-medium truncate flex-1 ${String(user.id) === localUserId ? 'text-green-300' : ''}`} title={user.username}>
                        {user.username} {String(user.id) === localUserId && '(Du)'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleCategory = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const handleOpenServerSettings = useCallback(() => {
    onOpenServerSettings();
  }, [onOpenServerSettings]);

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Header */}
      <div
        className="h-12 flex items-center gap-2 px-4 border-b border-white/5 transition-colors no-drag relative z-10"
        data-no-drag
      >
        <div
          className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer"
          role="button"
          tabIndex={0}
          data-no-drag
          onClick={handleOpenServerSettings}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpenServerSettings();
          }}
        >
          <span className="font-bold text-white truncate flex-1 min-w-0" title={serverName}>
            {serverName}
          </span>
          <button
            type="button"
            onClick={handleOpenServerSettings}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleOpenServerSettings();
            }}
            className="p-2 flex-shrink-0 rounded-md hover:bg-white/5 text-gray-500 hover:text-white focus:outline-none"
            title="Servereinstellungen"
            aria-label="Servereinstellungen"
          >
            <Settings size={16} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          className="p-1.5 flex-shrink-0 rounded-md hover:bg-white/10 text-gray-500 hover:text-white focus:outline-none"
          title="Kanal erstellen"
          data-no-drag
          onClick={(e) => {
            e.stopPropagation();
            setCreateType('text');
            setCreateCategoryId(null);
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} />
        </button>

        {/* Mobile: Close Navigation (wird bewusst im Header gerendert, damit es nicht über dem Zahnrad liegt) */}
        {onCloseMobileNav && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCloseMobileNav();
            }}
            className="lg:hidden p-2 -mr-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus:outline-none"
            title="Navigation schließen"
            aria-label="Navigation schließen"
            data-no-drag
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto pt-4 px-2 custom-scrollbar relative z-0">
           {uncategorized.map(c => renderChannel(c, false))}
           {categories.map(cat => (
             <div key={cat.id} className="mt-4">
                <div className="flex items-center justify-between group cursor-pointer no-drag mb-1 pl-1 pr-2" onClick={() => toggleCategory(cat.id)}>
                   <div className="flex items-center gap-1 text-gray-500 text-xs font-bold uppercase hover:text-gray-300">
                       {collapsed[cat.id] ? <ChevronRight size={10}/> : <ChevronDown size={10}/>}
                       {cat.name}
                   </div>
                   <button
                     type="button"
                     className="no-drag p-1 rounded-md text-gray-500 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/5"
                     title="Kanal in Kategorie erstellen"
                     onClick={(e) => {
                       e.stopPropagation();
                       setCreateType('text');
                       setCreateCategoryId(cat.id);
                       setShowCreateModal(true);
                     }}
                   >
                     <Plus size={14} />
                   </button>
                </div>
                {!collapsed[cat.id] && cat.channels.map(c => renderChannel(c, true))}
             </div>
           ))}
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
                  Stummschalten
                </button>
              ) : null}
              {permissions.move && contextMenu.channelId ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('remove', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
                >
                  Aus dem Talk entfernen
                </button>
              ) : null}
              {permissions.move && contextMenu.channelId && voiceChannels.length > 1 ? (
                <div className="px-2 py-1 space-y-1">
                  <div className="text-[11px] text-gray-500">In Talk verschieben</div>
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
                          targetChannelId: contextMenu.moveTargetId || undefined,
                        })
                      }
                    >
                      Move
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
                    Bann aussprechen
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                    onClick={() => performModeration('kick', { userId: contextMenu.userId })}
                  >
                    Vom Server kicken
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* --- STATUS PANEL (Verbindung) --- */}
        {connectionState === 'connected' && (
          <div className="bg-[#111214] border-t border-b border-white/5 p-2.5 space-y-2 relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col overflow-hidden mr-2">
                <div className="text-green-500 text-[10px] font-bold uppercase flex items-center gap-1.5 mb-0.5">
                  <Mic size={10} className="animate-pulse" /> Verbunden
                </div>
                <div className="text-white text-xs font-bold truncate">{activeChannelName}</div>
                {(cameraError || screenShareError) && (
                  <div className="text-[10px] text-red-400 truncate">{cameraError || screenShareError}</div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCamera().catch(console.error);
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-colors ${
                    isCameraEnabled
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                  } ${isPublishingCamera ? 'opacity-60 cursor-wait' : ''}`}
                  title={isCameraEnabled ? 'Kamera stoppen' : 'Kamera starten'}
                  disabled={isPublishingCamera}
                >
                  <Camera size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleScreenShare().catch(console.error);
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-colors ${
                    isScreenSharing
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                  } ${isPublishingScreen ? 'opacity-60 cursor-wait' : ''}`}
                  title={isScreenSharing ? 'Screen-Sharing stoppen' : 'Screen teilen'}
                  disabled={isPublishingScreen}
                >
                  <ScreenShare size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    disconnect().catch(console.error);
                  }}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                  title="Auflegen"
                >
                  <PhoneOff size={16} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        )}

        {shouldShowVoiceParticipants && (
          <div className="relative z-10">
            <VoiceParticipantsPanel />
          </div>
        )}

        <div className="relative z-10">
          <UserBottomBar />
        </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateChannelModal
          serverId={serverId!}
          categoryId={createCategoryId}
          defaultType={createType}
          theme={serverTheme}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
};
