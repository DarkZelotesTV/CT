import { useState, useRef } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

// Layout Components
import { ServerRail } from './ServerRail';
import { BottomChatBar, BottomChatBarRef } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

// Views
import { DashboardSidebar } from '../dashboard/DashboardSidebar';
import { FriendListStage } from '../dashboard/FriendListStage';
import { WebChannelView } from '../server/WebChannelView';
import { VoiceChannelView } from '../server/VoiceChannelView'; // NEU: Import

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
    <div className="flex h-screen w-screen bg-dark-100 font-sans select-none overflow-hidden relative">
      
      {/* 1. SERVER LEISTE */}
      <div className="w-[72px] flex-shrink-0 z-50 relative border-r border-dark-400 bg-dark-400">
        <ServerRail 
            selectedServerId={selectedServerId} 
            onSelectServer={handleServerSelect} 
        />
      </div>

      {/* 2. SIDEBAR */}
      <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 z-40 bg-dark-200", showLeftSidebar ? "w-60 border-r border-dark-400" : "w-0 overflow-hidden border-none")}> 
        <div className="w-60 h-full">
           {selectedServerId ? (
               <ChannelSidebar 
                  serverId={selectedServerId}
                  activeChannelId={activeChannel?.id || null} 
                  onSelectChannel={(channel) => {
                      if (channel.type === 'voice' || channel.type === 'web') {
                          // Voice & Web ersetzen die Stage/Mitte
                          setActiveChannel(channel);
                      } else {
                          // Text öffnet unten ein Fenster
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

      <button onClick={() => setShowLeftSidebar(!showLeftSidebar)} className="absolute top-1/2 z-50 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-all hover:scale-110" style={{ left: showLeftSidebar ? '300px' : '62px' }}>
        {showLeftSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* 3. MAIN SCREEN */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-dark-100 overflow-hidden">
        
        {selectedServerId ? (
            
            // --- SERVER MODUS ---
            // Prüfen welcher Kanaltyp aktiv ist
            activeChannel?.type === 'web' ? (
                // A) WEB KANAL
                <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
            ) : activeChannel?.type === 'voice' ? (
                // B) VOICE KANAL (NEU)
                <VoiceChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
            ) : (
                // C) LEERE STAGE ANSICHT (Default)
                <div className="flex-1 flex items-center justify-center relative z-0">
                    <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                    
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-300 mb-2">Stage Area</h2>
                        <p className="text-gray-500">Wähle einen Voice-Kanal links.</p>
                    </div>
                </div>
            )

        ) : (
            // --- DASHBOARD MODUS ---
            <div className="flex-1 relative z-0 h-full">
                <FriendListStage />
            </div>
        )}

        {/* CHAT LEISTE */}
        <BottomChatBar ref={chatBarRef} />

      </div>

      {/* 4. RECHTE SIDEBAR */}
      {selectedServerId && (
        <>
            <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 bg-dark-200 z-40 border-l border-dark-400", showRightSidebar ? "w-60" : "w-0 overflow-hidden")}>
                <div className="w-60 h-full">
                    <MemberSidebar serverId={selectedServerId} />
                </div>
            </div>
            <button onClick={() => setShowRightSidebar(!showRightSidebar)} className="absolute top-1/2 z-50 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-all hover:scale-110" style={{ right: showRightSidebar ? '225px' : '10px' }}>
                {showRightSidebar ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </>
      )}

    </div>
  );
};