import { useState, useEffect, useCallback, useRef } from 'react';
import { Hash, Volume2, Settings, Plus, ChevronDown, ChevronRight, Globe, Mic, PhoneOff, Camera, ScreenShare, Lock, ListChecks } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { UserBottomBar } from './UserBottomBar';
import { useVoice } from '../../context/voice-state'; // Importieren
import { VoiceParticipantsPanel } from "../voice/VoiceParticipantsPanel";
import { useSocket } from '../../context/SocketContext';
import { defaultServerTheme, deriveServerThemeFromSettings, type ServerTheme } from '../../theme/serverTheme';

// ... (Interfaces Channel, Category wie gehabt) ...
interface Channel { id: number; name: string; type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list'; custom_icon?: string; }
interface Category { id: number; name: string; channels: Channel[]; }
interface ChannelSidebarProps {
  serverId: number | null;
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenServerSettings: () => void;
  onResolveFallback?: (channel: Channel | null) => void;
}

export const ChannelSidebar = ({ serverId, activeChannelId, onSelectChannel, onOpenServerSettings, onResolveFallback }: ChannelSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('Server');
  const [serverTheme, setServerTheme] = useState<ServerTheme>(defaultServerTheme);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<Channel['type']>('text');
  const [createCategoryId, setCreateCategoryId] = useState<number | null>(null);
  const modalPortalRef = useRef<HTMLDivElement>(null);

  // CONTEXT NUTZEN
  const {
    connectToChannel,
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
  }, [activeChannelId, onResolveFallback, onSelectChannel, serverId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Click Handler: Voice Logik in den Hintergrund schieben
  const handleChannelClick = (c: Channel) => {
    if (c.type === 'spacer') return;
    if (c.type === 'voice') {
      connectToChannel(c.id, c.name).catch(console.error);
      onSelectChannel(c);
    } else {
      onSelectChannel(c);
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
    const isConnected = c.type === 'voice' && voiceChannelId === c.id; // Bin ich hier verbunden?
    const presenceList = channelPresence[c.id] || [];
    const hasPresence = presenceList.length > 0;

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

        {c.type === 'voice' && (
          <div className={`${isInside ? 'ml-8' : 'ml-6'} mr-2 mb-1 rounded-md border border-white/5 bg-white/5 px-2 py-1.5`}>
            <div className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1 font-bold">Im Kanal</div>
            {hasPresence ? (
              <div className="space-y-1">
                {presenceList.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 text-xs text-gray-200">
                    <span
                      className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}
                      title={user.status === 'online' ? 'Online' : 'Offline'}
                    />
                    <span className="font-medium truncate flex-1" title={user.username}>{user.username}</span>
                    <span className="text-[10px] uppercase text-gray-400">{user.status === 'online' ? 'Online' : 'Offline'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 py-0.5">Niemand im Kanal</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const toggleCategory = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      <div
        ref={modalPortalRef}
        className={`absolute inset-0 ${showCreateModal ? 'z-50' : '-z-10'}`}
        style={{ pointerEvents: showCreateModal ? 'auto' : 'none' }}
      />
      {/* Header */}
        <div className="h-12 flex items-center gap-2 px-4 border-b border-white/5 transition-colors no-drag relative z-10">
          <button
            type="button"
            onClick={onOpenServerSettings}
            className="group flex items-center gap-2 flex-1 text-left rounded-md px-2 py-2 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c10]"
            aria-label="Servereinstellungen öffnen"
          >
            <span className="font-bold text-white truncate flex-1">{serverName}</span>
            <Settings size={16} className="text-gray-500 group-hover:text-white" aria-hidden />
          </button>

          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c10]"
            title="Kanal erstellen"
            aria-label="Neuen Kanal erstellen"
            onClick={(e) => {
              e.stopPropagation();
              setCreateType('text');
              setCreateCategoryId(null);
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
          </button>
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
                  <PhoneOff size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10">
          <VoiceParticipantsPanel />
        </div>

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
          portalTarget={modalPortalRef.current}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
};
