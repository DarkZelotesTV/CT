import { useState, useRef } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Layout Components
import { ServerRail } from './ServerRail';
import { BottomChatBar, BottomChatBarRef } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

// Views
import { DashboardSidebar } from '../dashboard/DashboardSidebar';
import { FriendListStage } from '../dashboard/FriendListStage';
import { WebChannelView } from '../server/WebChannelView';
import { VoiceChannelView } from '../server/VoiceChannelView';

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

  const chatBarRef = useRef<BottomChatBarRef>(null);

  const handleServerSelect = (id: number | null) => {
      setSelectedServerId(id);
      setActiveChannel(null); 
  };

  return (
    <div className="flex h-screen w-screen bg-ts-base font-sans select-none overflow-hidden relative text-gray-200">
      
      {/* 1. SERVER LEISTE */}
      <div className="w-[72px] flex-shrink-0 z-50 relative border-r border-ts-border bg-ts-base">
        <ServerRail 
            selectedServerId={selectedServerId} 
            onSelectServer={handleServerSelect} 
        />
      </div>

      {/* 2. SIDEBAR (Links) */}
      <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 z-40 bg-ts-surface", showLeftSidebar ? "w-64 border-r border-ts-border" : "w-0 overflow-hidden border-none")}> 
        <div className="w-64 h-full">
           {selectedServerId ? (
               <ChannelSidebar 
                  serverId={selectedServerId}
                  activeChannelId={activeChannel?.id || null} 
                  onSelectChannel={(channel) => {
                      if (channel.type === 'voice' || channel.type === 'web') {
                          // Voice & Web ersetzen die Stage/Mitte
                          setActiveChannel(channel);
                      } else {
                          // Text öffnet unten ein Fenster (Overlay)
                          if (chatBarRef.current) {
                              chatBarRef.current.openChat(channel.id, channel.name);
                          }
                      }
                  }}
               />
           ) : (
               <DashboardSidebar />
           )}
        </div>
      </div>

      {/* Toggle Button Links (TeamSpeak Style: Klein & Technisch) */}
      <button 
        onClick={() => setShowLeftSidebar(!showLeftSidebar)} 
        className="absolute top-1/2 z-50 w-5 h-12 bg-ts-panel border border-ts-border rounded-r-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-ts-hover transition-all shadow-lg transform -translate-y-1/2" 
        style={{ left: showLeftSidebar ? '328px' : '71px' }} // 72px (Rail) + 256px (Sidebar) = 328px
      >
        {showLeftSidebar ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* 3. MAIN SCREEN */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-ts-base overflow-hidden">
        
        {selectedServerId ? (
            
            // --- SERVER MODUS ---
            // Prüfen welcher Kanaltyp aktiv ist
            activeChannel?.type === 'web' ? (
                // A) WEB KANAL
                <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
            ) : activeChannel?.type === 'voice' ? (
                // B) VOICE KANAL
                <VoiceChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
            ) : (
                // C) LEERE STAGE ANSICHT (Default)
                <div className="flex-1 flex items-center justify-center relative z-0">
                    <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
                    
                    <div className="text-center p-8 glass-panel rounded-xl">
                        <div className="mb-4 text-ts-accent opacity-80 mx-auto w-12 h-12 flex items-center justify-center bg-ts-accent/10 rounded-full">
                           <div className="w-3 h-3 bg-current rounded-full animate-pulse"></div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-200 mb-2 font-mono tracking-tight">System Bereit</h2>
                        <p className="text-gray-500 text-sm">Wähle einen Kanal aus der Liste, um zu beginnen.</p>
                    </div>
                </div>
            )

        ) : (
            // --- DASHBOARD MODUS ---
            <div className="flex-1 relative z-0 h-full">
                <FriendListStage />
            </div>
        )}

        {/* CHAT LEISTE (Overlay unten) */}
        <BottomChatBar ref={chatBarRef} />

      </div>

      {/* 4. RECHTE SIDEBAR */}
      {selectedServerId && (
        <>
            <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 bg-ts-surface z-40 border-l border-ts-border", showRightSidebar ? "w-60" : "w-0 overflow-hidden")}>
                <div className="w-60 h-full">
                    <MemberSidebar serverId={selectedServerId} />
                </div>
            </div>
            
            {/* Toggle Button Rechts */}
            <button 
                onClick={() => setShowRightSidebar(!showRightSidebar)} 
                className="absolute top-1/2 z-50 w-5 h-12 bg-ts-panel border border-ts-border rounded-l-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-ts-hover transition-all shadow-lg transform -translate-y-1/2" 
                style={{ right: showRightSidebar ? '240px' : '0' }}
            >
                {showRightSidebar ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
        </>
      )}

    </div>
  );
};