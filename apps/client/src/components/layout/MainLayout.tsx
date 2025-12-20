import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users, Menu, X } from 'lucide-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { useTranslation } from 'react-i18next';

import { ServerRail } from './ServerRail';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { TitleBar } from '../window/TitleBar';
import { TopBarProvider } from '../window/TopBarContext';

// Web & Voice Views
import { WebChannelView } from '../server/WebChannelView';
import { HomeOnboardingStage } from '../dashboard/HomeOnboardingStage';
import { VoiceChannelView, VoicePreJoin } from '../../features/voice/ui';

// Modals
import { OnboardingModal } from '../modals/OnboardingModal';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';
import { CreateServerModal } from '../modals/CreateServerModal';
import { JoinServerModal } from '../modals/JoinServerModal';

import { useVoice, type VoiceContextType } from '../../features/voice';
import { storage } from '../../shared/config/storage';

const defaultChannelWidth = 256;
const defaultMemberWidth = 256;
const minSidebarWidth = 200;
const maxSidebarWidth = 420;

// Breakpoint für Mobile/Desktop Umschaltung (entspricht Tailwind 'lg')
const MOBILE_BREAKPOINT = 1024; 

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
}

export const MainLayout = () => {
  const { t } = useTranslation();
  // UI State
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  
  // Resizable Widths (Desktop)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => storage.get('layoutLeftWidth'));
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => storage.get('layoutRightWidth'));
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  
  // Logic Refs
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });

  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;
  
  // App Data State
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverName, setServerName] = useState<string>('');
  const [titlebarHeight, setTitlebarHeight] = useState<number>(48);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [fallbackChannel, setFallbackChannel] = useState<Channel | null>(null);
  
  // Modals & Popups
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  
  const [lastNonVoiceChannel, setLastNonVoiceChannel] = useState<Channel | null>(null);
  const [pendingVoiceChannelId, setPendingVoiceChannelId] = useState<number | null>(null);
  const [serverRefreshKey, setServerRefreshKey] = useState(0);

  // Voice Context
  const {
    activeRoom,
    activeChannelId: connectedVoiceChannelId,
    activeChannelName: connectedVoiceChannelName,
    connectionState,
    muted,
    connectToChannel,
  } = useVoice();

  // --- Width Calculation Logic ---
  const computedMaxSidebarWidth = useMemo(() => {
    if (!containerWidth) return maxSidebarWidth;
    const dynamicMax = Math.floor(containerWidth * 0.4);
    return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, dynamicMax));
  }, [containerWidth]);

  const clampSidebarWidth = useCallback(
    (value: number) => Math.min(Math.max(value, minSidebarWidth), computedMaxSidebarWidth),
    [computedMaxSidebarWidth]
  );

  // --- LocalStorage für Sidebar Breite ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLeft = storage.get('layoutLeftWidth');
    setLeftSidebarWidth(clampSidebarWidth(storedLeft));

    const storedRight = storage.get('layoutRightWidth');
    setRightSidebarWidth(clampSidebarWidth(storedRight));
  }, [clampSidebarWidth]);

  useEffect(() => {
    storage.set('layoutLeftWidth', clampSidebarWidth(leftSidebarWidth));
  }, [clampSidebarWidth, leftSidebarWidth]);

  useEffect(() => {
    storage.set('layoutRightWidth', clampSidebarWidth(rightSidebarWidth));
  }, [clampSidebarWidth, rightSidebarWidth]);

  // --- Resize Observer ---
  useEffect(() => {
    if (!layoutRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Auto-Close Mobile Nav on Selection ---
  useEffect(() => {
    setShowMemberSheet(false);
    if (window.innerWidth < MOBILE_BREAKPOINT) {
        setShowMobileNav(false);
    }
  }, [activeChannel?.id]);

  // --- Fallback Channel Logic ---
  useEffect(() => {
    if (!activeChannel && fallbackChannel) {
      setActiveChannel(fallbackChannel);
      if (fallbackChannel.type !== 'voice') {
        setPendingVoiceChannelId(null);
        setLastNonVoiceChannel(fallbackChannel);
      }
    }
  }, [activeChannel, fallbackChannel]);

  // --- Voice Connection Handling ---
  const previousConnectionState = useRef<VoiceContextType['connectionState'] | null>(null);
  useEffect(() => {
    const prev = previousConnectionState.current;
    if (prev && prev !== 'disconnected' && connectionState === 'disconnected' && activeChannel?.type === 'voice') {
      if (fallbackChannel) setActiveChannel(fallbackChannel);
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

  // --- Onboarding Check ---
  useEffect(() => {
    if (!storage.get('onboardingDone')) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    const pending = storage.get('pendingServerId');
    if (pending) {
      setSelectedServerId(pending);
      storage.remove('pendingServerId');
    }
  }, []);

  // --- Handlers ---
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
    setShowMobileNav(false); 
  }, []);

  const handleResolveFallback = useCallback((channel: Channel | null) => {
    setFallbackChannel((prev) => (prev?.id === channel?.id ? prev : channel));
  }, []);

  const handleVoiceJoin = useCallback(async (channel: Channel) => {
      await connectToChannel(channel.id, channel.name);
    }, [connectToChannel]);

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
    }, [announceServerChange]
  );

  const handleServerDeleted = useCallback(() => {
    announceServerChange();
    handleServerSelect(null);
  }, [announceServerChange, handleServerSelect]);

  // --- Dragging Handlers ---
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
        setLeftSidebarWidth(clampSidebarWidth(dragState.current.startWidth + delta));
      }
      if (isDraggingRight) {
        const delta = event.clientX - dragState.current.startX;
        setRightSidebarWidth(clampSidebarWidth(dragState.current.startWidth - delta));
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
  }, [isDraggingLeft, isDraggingRight, clampSidebarWidth]);

  // --- Render Content Logic ---
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
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="text-center p-10 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-2">{t('layout.textChannelSelected')}</h2>
            <p className="text-gray-500 text-sm max-w-md">{t('layout.textChannelUnsupported')}</p>
          </div>
        </div>
      );
    }
    if (activeChannel?.type === 'voice') {
      const isConnectedToTarget = connectedVoiceChannelId === activeChannel.id && connectionState === 'connected';
      // ... (Voice logic bleibt gleich)
      if (isConnectedToTarget) {
        return <VoiceChannelView channelName={activeChannel.name} />;
      }
      return (
        <VoicePreJoin
          channel={activeChannel}
          onJoin={() => handleVoiceJoin(activeChannel)}
          onCancel={handleVoiceCancel}
          isJoining={pendingVoiceChannelId === activeChannel.id && (connectionState === 'connecting' || connectionState === 'reconnecting')}
          connectedChannelName={connectedVoiceChannelName}
          connectedElsewhere={connectedVoiceChannelId !== null && connectedVoiceChannelId !== activeChannel.id && connectionState !== 'disconnected'}
        />
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center relative h-full">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="text-center p-12 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-2">{t('layout.stageAreaTitle')}</h2>
          <p className="text-gray-500 text-sm">{t('layout.stageAreaDescription')}</p>
        </div>
      </div>
    );
  };

  const ui = (
    <TopBarProvider>
    <div
      ref={layoutRef}
      style={isDesktop ? { paddingTop: titlebarHeight } : undefined}
      className={classNames(
        "flex h-screen w-screen overflow-visible relative bg-[#050507] text-gray-200 font-sans box-border"
      )}
    >
      {isDesktop && <TitleBar serverName={serverName} channel={activeChannel} showRightSidebar={showRightSidebar} onToggleRightSidebar={() => setShowRightSidebar((v) => !v)} onOpenServerSettings={() => setShowServerSettings(true)} />}
      
      {/* --- GLOBAL MODALS --- */}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      {showCreateServer && <CreateServerModal onClose={() => setShowCreateServer(false)} onCreated={() => { announceServerChange(); setShowCreateServer(false); }} />}
      {showJoinServer && <JoinServerModal onClose={() => setShowJoinServer(false)} onJoined={() => { announceServerChange(); setShowJoinServer(false); }} />}
      {selectedServerId && showServerSettings && (
        <ServerSettingsModal serverId={selectedServerId} onClose={() => setShowServerSettings(false)} onUpdated={handleServerUpdated} onDeleted={handleServerDeleted} />
      )}

      {/* Overlay Backdrop für Mobile */}
      <div 
        className={classNames(
          "fixed inset-0 bg-black/80 z-40 lg:hidden transition-opacity duration-300",
          showMobileNav ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setShowMobileNav(false)}
      />

      {/* Navigation Container */}
      <div className={classNames(
        "flex h-full z-50 transition-transform duration-300 ease-in-out",
        "lg:relative lg:translate-x-0",
        "fixed inset-y-0 left-0 max-lg:w-[85vw] max-lg:max-w-[320px]",
        showMobileNav ? "translate-x-0" : "max-lg:-translate-x-full"
      )}>
        
        {/* 1. SERVER RAIL - Hier werden jetzt die Props übergeben! */}
        {/*
          The ServerRail contains a popover (Create/Join) that overflows into the ChannelSidebar.
          When a server is selected, the ChannelSidebar is rendered after the rail and creates its
          own stacking context (backdrop-filter/overflow), which can paint above the rail popover.
          Give the rail a higher stacking context so the popover stays visible.
        */}
        <div className="w-[80px] flex-shrink-0 flex flex-col items-center py-3 h-full relative z-[80]">
           <div className="w-full h-full bg-[#0a0a0c]/90 backdrop-blur-xl rounded-2xl border border-white/5 ml-3 shadow-2xl overflow-visible relative z-[80]">
             <ServerRail
                selectedServerId={selectedServerId}
                onSelectServer={handleServerSelect}
                onCreateServer={() => setShowCreateServer(true)}
                onJoinServer={() => setShowJoinServer(true)}
             />
           </div>
        </div>

        {/* 2. CHANNEL SIDEBAR */}
        {selectedServerId && (
            <div 
                ref={leftSidebarRef}
                className="h-full py-3 pl-3 flex-shrink-0 transition-all duration-300 relative z-[60]"
                style={{ width: typeof window !== 'undefined' && window.innerWidth < 1024 ? 'calc(100% - 80px)' : leftSidebarWidth }}
            >
                <div className="w-full h-full bg-[#0e0e11]/90 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden flex flex-col relative">
                    <ChannelSidebar onServerNameChange={(name) => setServerName(name)}
                        serverId={selectedServerId}
                        activeChannelId={activeChannel?.id || null}
                        onSelectChannel={handleChannelSelect}
                        onOpenServerSettings={() => { setShowServerSettings(true); setShowMobileNav(false); }}
                        onCloseMobileNav={() => setShowMobileNav(false)}
                        onResolveFallback={handleResolveFallback}
                        refreshKey={serverRefreshKey}
                    />
                </div>
                <div className="hidden lg:block absolute top-0 right-0 h-full w-2 cursor-ew-resize hover:bg-white/5" onMouseDown={startDragLeft} />
            </div>
        )}
      </div>

      {/* === MAIN CONTENT AREA === */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full py-3 px-3 overflow-hidden">
        {/* MOBILE HEADER */}
        <div className="lg:hidden flex items-center gap-3 mb-3 px-1">
            <button 
                onClick={() => setShowMobileNav(true)}
                className="p-2 bg-[#1a1b1e] rounded-xl border border-white/10 text-white shadow-lg active:scale-95 transition-transform"
            >
                <Menu size={20} />
            </button>
            <span className="font-bold text-white truncate">
                {activeChannel?.name || "Chat"}
            </span>
            {selectedServerId && (
                <button 
                    onClick={() => setShowMemberSheet(true)}
                    className="ml-auto p-2 bg-[#1a1b1e] rounded-xl border border-white/10 text-white shadow-lg"
                >
                    <Users size={20} />
                </button>
            )}
        </div>

        <div className="flex-1 bg-[#09090b] rounded-2xl border border-white/5 relative overflow-hidden shadow-2xl flex flex-col">
          {renderContent()}
        </div>

        {/* Desktop Member Toggle */}
        {selectedServerId && (
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-l-xl backdrop-blur-md items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
            style={{ right: showRightSidebar ? 12 : 12 }}
          >
            {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* MEMBER SIDEBARS (Desktop & Mobile) - Code unverändert übernommen ... */}
      {selectedServerId && (
        <div
          ref={rightSidebarRef}
          className={classNames(
            'hidden lg:block transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pr-3',
            showRightSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pr-0'
          )}
          style={{ width: showRightSidebar ? rightSidebarWidth : 0 }}
        >
          <div className="w-full h-full bg-[#0e0e11]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <MemberSidebar serverId={selectedServerId} />
          </div>
          {showRightSidebar && (
            <div className="absolute top-0 left-0 h-full w-2 cursor-ew-resize hover:bg-white/5" onMouseDown={startDragRight} />
          )}
        </div>
      )}

      {selectedServerId && (
        <div
          className={classNames(
            'lg:hidden fixed inset-x-0 bottom-0 z-[60] transition-transform duration-500',
            showMemberSheet ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="absolute inset-0 h-screen bg-black/60 backdrop-blur-sm -top-[100vh]" onClick={() => setShowMemberSheet(false)} style={{ display: showMemberSheet ? 'block' : 'none' }} />
          <div className="relative bg-[#0e0e11] border-t border-white/10 rounded-t-3xl overflow-hidden shadow-2xl h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#1a1b1e]">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={16} />
                Mitglieder
              </div>
              <button onClick={() => setShowMemberSheet(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-200">
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MemberSidebar serverId={selectedServerId} />
            </div>
          </div>
        </div>
      )}

      {activeRoom && !muted && <RoomAudioRenderer />}
    </div>
    </TopBarProvider>
  );

  if (!activeRoom) return ui;
  return <RoomContext.Provider value={activeRoom}>{ui}</RoomContext.Provider>;
};