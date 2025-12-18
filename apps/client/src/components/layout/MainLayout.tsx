import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import '@livekit/components-styles';

import { ServerRail } from './ServerRail';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

// DashboardSidebar Import wurde HIER ENTFERNT, da wir die Leiste gelöscht haben

import { WebChannelView } from '../server/WebChannelView';
import { HomeOnboardingStage } from '../dashboard/HomeOnboardingStage';
import { VoiceChannelView } from '../voice/VoiceChannelView';
import { VoicePreJoin } from '../voice/VoicePreJoin';

import { OnboardingModal } from '../modals/OnboardingModal';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';
import { CreateServerModal } from '../modals/CreateServerModal';
import { JoinServerModal } from '../modals/JoinServerModal';

import { useVoice, type VoiceContextType } from '../../context/voice-state';

const defaultChannelWidth = 256;
const defaultMemberWidth = 256;
const minSidebarWidth = 200;
const maxSidebarWidth = 420;

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
}

export const MainLayout = () => {
  const [showServerRail, setShowServerRail] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1024));
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(defaultChannelWidth);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(defaultMemberWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < 1024));
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [fallbackChannel, setFallbackChannel] = useState<Channel | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [lastNonVoiceChannel, setLastNonVoiceChannel] = useState<Channel | null>(null);
  const [pendingVoiceChannelId, setPendingVoiceChannelId] = useState<number | null>(null);
  const [serverRefreshKey, setServerRefreshKey] = useState(0);

  // Voice Context holen
  const {
    activeRoom,
    activeChannelId: connectedVoiceChannelId,
    activeChannelName: connectedVoiceChannelName,
    connectionState,
    muted,
    connectToChannel,
  } = useVoice();

  const computedMaxSidebarWidth = useMemo(() => {
    if (!containerWidth) return maxSidebarWidth;
    const dynamicMax = Math.floor(containerWidth * 0.4);
    return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, dynamicMax));
  }, [containerWidth]);

  const clampSidebarWidth = useCallback(
    (value: number) => Math.min(Math.max(value, minSidebarWidth), computedMaxSidebarWidth),
    [computedMaxSidebarWidth]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLeft = localStorage.getItem('ct.layout.left_width');
    if (storedLeft) {
      const parsed = Number(storedLeft);
      setLeftSidebarWidth(Number.isFinite(parsed) ? clampSidebarWidth(parsed) : defaultChannelWidth);
    }

    const storedRight = localStorage.getItem('ct.layout.right_width');
    if (storedRight) {
      const parsed = Number(storedRight);
      setRightSidebarWidth(Number.isFinite(parsed) ? clampSidebarWidth(parsed) : defaultMemberWidth);
    }
  }, [clampSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('ct.layout.left_width', String(clampSidebarWidth(leftSidebarWidth)));
  }, [clampSidebarWidth, leftSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('ct.layout.right_width', String(clampSidebarWidth(rightSidebarWidth)));
  }, [clampSidebarWidth, rightSidebarWidth]);

  useEffect(() => {
    setLeftSidebarWidth((width) => clampSidebarWidth(width));
    setRightSidebarWidth((width) => clampSidebarWidth(width));
  }, [clampSidebarWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1024);
      setContainerWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!layoutRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      setContainerWidth(entries[0].contentRect.width);
    });

    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isNarrow) {
      setShowLeftSidebar(false);
      setShowRightSidebar(false);
      setShowServerRail(false);
    } else {
      setShowServerRail(true);
    }
  }, [isNarrow]);

  useEffect(() => {
    if (!isNarrow) {
      setShowMemberSheet(false);
    }
  }, [isNarrow]);

  useEffect(() => {
    setShowMemberSheet(false);
  }, [activeChannel?.id]);

  useEffect(() => {
    if (!activeChannel && fallbackChannel) {
      setActiveChannel(fallbackChannel);
      if (fallbackChannel.type !== 'voice') {
        setPendingVoiceChannelId(null);
        setLastNonVoiceChannel(fallbackChannel);
      }
    }
  }, [activeChannel, fallbackChannel]);

  const previousConnectionState = useRef<VoiceContextType['connectionState'] | null>(null);

  useEffect(() => {
    const prev = previousConnectionState.current;

    if (prev && prev !== 'disconnected' && connectionState === 'disconnected' && activeChannel?.type === 'voice') {
      if (fallbackChannel) {
        setActiveChannel(fallbackChannel);
      }
    }

    previousConnectionState.current = connectionState;
  }, [activeChannel, connectionState, fallbackChannel]);

  useEffect(() => {
    if (
      connectedVoiceChannelId &&
      pendingVoiceChannelId &&
      connectedVoiceChannelId === pendingVoiceChannelId &&
      connectionState === 'connected'
    ) {
      setPendingVoiceChannelId(null);
    }
  }, [connectedVoiceChannelId, connectionState, pendingVoiceChannelId]);

  useEffect(() => {
    if (!localStorage.getItem('ct.onboarding.v1.done')) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    const pending = localStorage.getItem('ct.pending_server_id');
    if (pending && /^\d+$/.test(pending)) {
      setSelectedServerId(Number(pending));
      localStorage.removeItem('ct.pending_server_id');
    }
  }, []);

  const handleServerSelect = useCallback((id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setFallbackChannel(null);
    setShowServerSettings(false);
  }, []);

  const handleChannelSelect = useCallback((channel: Channel) => {
    setActiveChannel(channel);
    if (channel.type === 'voice') {
      setPendingVoiceChannelId(channel.id);
    } else {
      setPendingVoiceChannelId(null);
      setLastNonVoiceChannel(channel);
    }
    if (isNarrow) {
      setShowLeftSidebar(false);
    }
  }, [isNarrow]);

  const handleResolveFallback = useCallback((channel: Channel | null) => {
    setFallbackChannel((prev) => {
      if (prev?.id === channel?.id) return prev;
      return channel;
    });
  }, []);

  const handleVoiceJoin = useCallback(
    async (channel: Channel) => {
      await connectToChannel(channel.id, channel.name);
    },
    [connectToChannel]
  );

  const handleVoiceCancel = useCallback(() => {
    setPendingVoiceChannelId(null);
    if (connectedVoiceChannelId && connectedVoiceChannelName) {
      setActiveChannel({ id: connectedVoiceChannelId, name: connectedVoiceChannelName, type: 'voice' });
      return;
    }
    if (lastNonVoiceChannel) {
      setActiveChannel(lastNonVoiceChannel);
      return;
    }
    if (fallbackChannel) {
      setActiveChannel(fallbackChannel);
      return;
    }
    setActiveChannel(null);
  }, [connectedVoiceChannelId, connectedVoiceChannelName, fallbackChannel, lastNonVoiceChannel]);

  const announceServerChange = useCallback(() => {
    window.dispatchEvent(new Event('ct-servers-changed'));
  }, []);

  const handleServerUpdated = useCallback(
    ({ fallbackChannelId }: { name: string; fallbackChannelId: number | null }) => {
      announceServerChange();
      setServerRefreshKey((value) => value + 1);
      setFallbackChannel((prev) => (prev && prev.id === fallbackChannelId ? prev : null));
      setShowServerSettings(false);
    },
    [announceServerChange]
  );

  const handleServerDeleted = useCallback(() => {
    announceServerChange();
    handleServerSelect(null);
  }, [announceServerChange, handleServerSelect]);

  const startDragLeft = (event: React.MouseEvent) => {
    setIsDraggingLeft(true);
    dragState.current = { startX: event.clientX, startWidth: leftSidebarWidth };
  };

  const startDragRight = (event: React.MouseEvent) => {
    setIsDraggingRight(true);
    dragState.current = { startX: event.clientX, startWidth: rightSidebarWidth };
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingLeft) {
        const delta = event.clientX - dragState.current.startX;
        const nextWidth = clampSidebarWidth(dragState.current.startWidth + delta);
        setLeftSidebarWidth(nextWidth);
      }

      if (isDraggingRight) {
        const delta = event.clientX - dragState.current.startX;
        const nextWidth = clampSidebarWidth(dragState.current.startWidth - delta);
        setRightSidebarWidth(nextWidth);
      }
    };

    const stopDragging = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDragging);
      document.body.classList.add('select-none');
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      document.body.classList.remove('select-none');
    };
  }, [isDraggingLeft, isDraggingRight]);

  const renderContent = () => {
    if (!selectedServerId) {
      return (
        <div className="flex-1 relative h-full">
          <HomeOnboardingStage
            onCreateServer={() => setShowCreateServer(true)}
            onJoinServer={() => setShowJoinServer(true)}
          />
        </div>
      );
    }

    if (activeChannel?.type === 'web') {
      return <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
    }

    if (activeChannel?.type === 'text') {
      return (
        <div className="flex-1 flex items-center justify-center relative h-full">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="text-center p-10 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-2">Textkanal ausgewählt</h2>
            <p className="text-gray-500 text-sm max-w-md">
              Textkanäle werden derzeit nicht unterstützt. Bitte wähle einen Sprach- oder Web-Kanal aus, um fortzufahren.
            </p>
          </div>
        </div>
      );
    }

    if (activeChannel?.type === 'voice') {
      const isConnectedToTarget = connectedVoiceChannelId === activeChannel.id && connectionState === 'connected';
      const isJoiningTarget = pendingVoiceChannelId === activeChannel.id &&
        (connectionState === 'connecting' || connectionState === 'reconnecting');
      const connectedElsewhere =
        connectedVoiceChannelId !== null && connectedVoiceChannelId !== activeChannel.id && connectionState !== 'disconnected';

      if (isConnectedToTarget) {
        return <VoiceChannelView channelName={activeChannel.name} />;
      }

      return (
        <VoicePreJoin
          channel={activeChannel}
          onJoin={() => handleVoiceJoin(activeChannel)}
          onCancel={handleVoiceCancel}
          isJoining={isJoiningTarget}
          connectedChannelName={connectedVoiceChannelName}
          connectedElsewhere={connectedElsewhere}
        />
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center relative h-full">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="text-center p-12 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-2">Stage Area</h2>
          <p className="text-gray-500 text-sm">Wähle einen Kanal links.</p>
        </div>
      </div>
    );
  };

  const ui = (
    <div ref={layoutRef} className="flex h-screen w-screen overflow-auto relative bg-[#050507] text-gray-200 font-sans">
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreated={() => {
            announceServerChange();
            setShowCreateServer(false);
          }}
        />
      )}
      {showJoinServer && (
        <JoinServerModal
          onClose={() => setShowJoinServer(false)}
          onJoined={() => {
            announceServerChange();
            setShowJoinServer(false);
          }}
        />
      )}
      {selectedServerId && showServerSettings && (
        <ServerSettingsModal
          serverId={selectedServerId}
          onClose={() => setShowServerSettings(false)}
          onUpdated={handleServerUpdated}
          onDeleted={handleServerDeleted}
        />
      )}
      {/* 1. SERVER RAIL */}
      {showServerRail && (
        <div className="w-[80px] flex-shrink-0 z-50 flex flex-col items-center py-3 h-full transition-transform duration-500">
          <div className="w-full h-full bg-[#0a0a0c]/80 backdrop-blur-xl rounded-2xl border border-white/5 ml-3 shadow-2xl">
            <ServerRail selectedServerId={selectedServerId} onSelectServer={handleServerSelect} />
          </div>
        </div>
      )}

      {/* 2. SIDEBAR - WIRD JETZT NUR ANGEZEIGT, WENN EIN SERVER AUSGEWÄHLT IST */}
      {selectedServerId && (
        <div
          ref={leftSidebarRef}
          className={classNames(
            'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pl-3',
            showLeftSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pl-0',
            isNarrow && 'fixed inset-y-3 left-3 right-3 z-50'
          )}
          style={{ width: showLeftSidebar && !isNarrow ? leftSidebarWidth : isNarrow && showLeftSidebar ? 'auto' : 0 }}
        >
          <div className="w-full h-full bg-[#0e0e11]/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <ChannelSidebar
              serverId={selectedServerId}
              activeChannelId={activeChannel?.id || null}
              onSelectChannel={handleChannelSelect}
              onOpenServerSettings={() => setShowServerSettings(true)}
              onResolveFallback={handleResolveFallback}
              refreshKey={serverRefreshKey}
            />
          </div>
          {showLeftSidebar && !isNarrow && (
            <div
              className="absolute top-0 right-0 h-full w-2 cursor-ew-resize bg-transparent hover:bg-white/5"
              onMouseDown={startDragLeft}
            />
          )}
        </div>
      )}

      {/* 3. MAIN STAGE */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full py-3 px-3 overflow-auto">
        {/* Chevron nur anzeigen, wenn auch eine Sidebar existiert (also wenn ein Server ausgewählt ist) */}
        {!isNarrow && selectedServerId && (
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-r-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            {showLeftSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        {isNarrow && (
          <div className="absolute top-4 left-4 z-40 flex gap-2">
            <button
              onClick={() => setShowServerRail((value) => !value)}
              className="px-3 py-2 rounded-full bg-black/40 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 backdrop-blur-md shadow-lg"
            >
              {showServerRail ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            {/* "Channels" Button nur anzeigen, wenn Server ausgewählt ist */}
            {selectedServerId && (
              <button
                onClick={() => setShowLeftSidebar(true)}
                className="px-3 py-2 rounded-full bg-black/40 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 backdrop-blur-md shadow-lg"
              >
                Channels
              </button>
            )}
          </div>
        )}

        <div className="flex-1 bg-[#09090b] rounded-2xl border border-white/5 relative overflow-auto shadow-2xl flex flex-col">
          {renderContent()}
        </div>

        {selectedServerId && !isNarrow && (
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-l-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
            style={{ right: showRightSidebar ? 12 : 12 }}
          >
            {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* 4. MEMBER SIDEBAR */}
      {selectedServerId && !isNarrow && (
        <div
          ref={rightSidebarRef}
          className={classNames(
            'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pr-3',
            showRightSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pr-0'
          )}
          style={{ width: showRightSidebar ? rightSidebarWidth : 0 }}
        >
          <div className="w-full h-full bg-[#0e0e11]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <MemberSidebar serverId={selectedServerId} />
          </div>
          {showRightSidebar && (
            <div
              className="absolute top-0 left-0 h-full w-2 cursor-ew-resize bg-transparent hover:bg-white/5"
              onMouseDown={startDragRight}
            />
          )}
        </div>
      )}

      {/* MOBILE MEMBER SHEET */}
      {selectedServerId && isNarrow && (
        <div
          className={classNames(
            'fixed inset-x-0 bottom-0 z-50 transition-transform duration-500',
            showMemberSheet ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMemberSheet(false)} />
          <div className="relative bg-[#0e0e11]/95 border-t border-white/10 rounded-t-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={16} />
                Mitglieder
              </div>
              <button
                onClick={() => setShowMemberSheet(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-200 transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="max-h-[70vh] h-[60vh] overflow-y-auto custom-scrollbar px-3 pb-6">
              <MemberSidebar serverId={selectedServerId} />
            </div>
          </div>
        </div>
      )}

      {/* 5. AUDIO RENDERER */}
      {activeRoom && !muted && <RoomAudioRenderer />}
    </div>
  );

  if (!activeRoom) return ui;

  return <RoomContext.Provider value={activeRoom}>{ui}</RoomContext.Provider>;
};
