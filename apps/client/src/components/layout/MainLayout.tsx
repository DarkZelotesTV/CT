import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import '@livekit/components-styles';

import { ServerRail } from './ServerRail';
import { BottomChatBar } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

import { DashboardSidebar } from '../dashboard/DashboardSidebar';
import { FriendListStage } from '../dashboard/FriendListStage';
import { WebChannelView } from '../server/WebChannelView';
import { HomeOnboardingStage } from '../dashboard/HomeOnboardingStage';
import { ChatChannelView } from '../server/ChatChannelView';

import { OnboardingModal } from '../modals/OnboardingModal';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';
import { CreateServerModal } from '../modals/CreateServerModal';
import { JoinServerModal } from '../modals/JoinServerModal';

import { useVoice } from '../../context/voice-state';

const defaultChannelWidth = 256;
const defaultMemberWidth = 256;
const minSidebarWidth = 200;
const maxSidebarWidth = 420;
const clampSidebarWidth = (value: number) => Math.min(Math.max(value, minSidebarWidth), maxSidebarWidth);

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web';
}

export const MainLayout = () => {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultChannelWidth;
    const stored = localStorage.getItem('ct.layout.left_width');
    if (!stored) return defaultChannelWidth;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : defaultChannelWidth;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultMemberWidth;
    const stored = localStorage.getItem('ct.layout.right_width');
    if (!stored) return defaultMemberWidth;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : defaultMemberWidth;
  });
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [homeView, setHomeView] = useState<'home' | 'friends'>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);

  // Voice Context holen
  const { activeRoom } = useVoice();

  useEffect(() => {
    localStorage.setItem('ct.layout.left_width', String(leftSidebarWidth));
  }, [leftSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('ct.layout.right_width', String(rightSidebarWidth));
  }, [rightSidebarWidth]);

  useEffect(() => {
    // One-time tutorial after the first successful start.
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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron?.onChatDocked) return;

    const unsubscribe = window.electron.onChatDocked((chatId, chatName) => {
      setActiveChannel({ id: Number(chatId), name: chatName, type: 'text' });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleServerSelect = (id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setHomeView('home');
    setShowServerSettings(false);
  };

  const announceServerChange = () => {
    window.dispatchEvent(new Event('ct-servers-changed'));
  };

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

  // Helper: Rendert den Inhalt der Main Stage
  const renderContent = () => {
    if (!selectedServerId) {
      if (homeView === 'friends') {
        return (
          <div className="flex-1 relative h-full">
            <FriendListStage onBackToHome={() => setHomeView('home')} />
          </div>
        );
      }

      return (
        <div className="flex-1 relative h-full">
          <HomeOnboardingStage
            onCreateServer={() => setShowCreateServer(true)}
            onJoinServer={() => setShowJoinServer(true)}
            onOpenFriends={() => setHomeView('friends')}
          />
        </div>
      );
    }

    if (activeChannel?.type === 'web') {
      return <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
    }

    if (activeChannel?.type === 'text') {
      return <ChatChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
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

  // Dein komplettes UI bleibt gleich – nur ohne LiveKitRoom wrapper
  const ui = (
    <div className="flex h-screen w-screen overflow-hidden relative bg-[#050507] text-gray-200 font-sans">
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
        <ServerSettingsModal serverId={selectedServerId} onClose={() => setShowServerSettings(false)} />
      )}
      {/* 1. SERVER RAIL */}
      <div className="w-[80px] flex-shrink-0 z-50 flex flex-col items-center py-3 h-full">
        <div className="w-full h-full bg-[#0a0a0c]/80 backdrop-blur-xl rounded-2xl border border-white/5 ml-3 shadow-2xl">
          <ServerRail selectedServerId={selectedServerId} onSelectServer={handleServerSelect} />
        </div>
      </div>

      {/* 2. SIDEBAR */}
      <div
        ref={leftSidebarRef}
        className={classNames(
          'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pl-3',
          showLeftSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pl-0'
        )}
        style={{ width: showLeftSidebar ? leftSidebarWidth : 0 }}
      >
        <div className="w-full h-full bg-[#0e0e11]/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
          {selectedServerId ? (
            <ChannelSidebar
              serverId={selectedServerId}
              activeChannelId={activeChannel?.id || null}
              onSelectChannel={(channel) => {
                setActiveChannel(channel);
              }}
              onOpenServerSettings={() => setShowServerSettings(true)}
            />
          ) : (
            <DashboardSidebar />
          )}
        </div>
        {showLeftSidebar && (
          <div
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize bg-transparent hover:bg-white/5"
            onMouseDown={startDragLeft}
          />
        )}
      </div>

      {/* 3. MAIN STAGE */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full py-3 px-3 overflow-hidden">
        <button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-r-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
        >
          {showLeftSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 bg-[#09090b] rounded-2xl border border-white/5 relative overflow-hidden shadow-2xl flex flex-col">
          {renderContent()}
          <BottomChatBar
            channelId={activeChannel?.type === 'text' ? activeChannel.id : null}
            channelName={activeChannel?.type === 'text' ? activeChannel.name : undefined}
          />
        </div>

        {selectedServerId && (
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
      {selectedServerId && (
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

      {/* 5. AUDIO RENDERER (Unsichtbar, aber spielt Sound ab) */}
      {activeRoom && <RoomAudioRenderer />}
    </div>
  );

  // Wenn kein Room existiert: normal rendern
  if (!activeRoom) return ui;

  // Wenn Room existiert: RoomContext bereitstellen (ohne LiveKitRoom!)
  return <RoomContext.Provider value={activeRoom}>{ui}</RoomContext.Provider>;
};
