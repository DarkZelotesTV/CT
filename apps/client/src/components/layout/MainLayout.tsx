import { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import '@livekit/components-styles';

import { ServerRail } from './ServerRail';
import { BottomChatBar, BottomChatBarRef } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

import { DashboardSidebar } from '../dashboard/DashboardSidebar';
import { FriendListStage } from '../dashboard/FriendListStage';
import { WebChannelView } from '../server/WebChannelView';

import { OnboardingModal } from '../modals/OnboardingModal';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';

import { useVoice } from '../../context/voice-state';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web';
}

export const MainLayout = () => {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const chatBarRef = useRef<BottomChatBarRef>(null);

  // Voice Context holen
  const { activeRoom } = useVoice();

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
      chatBarRef.current?.openChat(Number(chatId), chatName);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleServerSelect = (id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setShowServerSettings(false);
  };

  // Helper: Rendert den Inhalt der Main Stage
  const renderContent = () => {
    if (!selectedServerId) {
      return (
        <div className="flex-1 relative h-full">
          <FriendListStage />
        </div>
      );
    }

    if (activeChannel?.type === 'web') {
      return <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
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
        className={classNames(
          'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pl-3',
          showLeftSidebar ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-10 pl-0'
        )}
      >
        <div className="w-full h-full bg-[#0e0e11]/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
          {selectedServerId ? (
            <ChannelSidebar
              serverId={selectedServerId}
              activeChannelId={activeChannel?.id || null}
              onSelectChannel={(channel) => {
                if (channel.type === 'voice' || channel.type === 'web') setActiveChannel(channel);
                else chatBarRef.current?.openChat(channel.id, channel.name);
              }}
              onOpenServerSettings={() => setShowServerSettings(true)}
            />
          ) : (
            <DashboardSidebar />
          )}
        </div>
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
          <BottomChatBar ref={chatBarRef} />
        </div>

        {selectedServerId && (
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-l-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* 4. MEMBER SIDEBAR */}
      {selectedServerId && (
        <div
          className={classNames(
            'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pr-3',
            showRightSidebar ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 pr-0'
          )}
        >
          <div className="w-full h-full bg-[#0e0e11]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <MemberSidebar serverId={selectedServerId} />
          </div>
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
