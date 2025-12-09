import { useState } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

// Layout Components
import { ServerRail } from './ServerRail';
import { BottomChatBar } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { DashboardSidebar } from '../dashboard/DashboardSidebar';
import { FriendListStage } from '../dashboard/FriendListStage'; // WICHTIG: Das hier stellt dein Design wieder her!
import { ChatChannelView } from '../server/ChatChannelView';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
}

export const MainLayout = () => {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showStageSettings, setShowStageSettings] = useState(false);
  
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const handleServerSelect = (id: number | null) => {
      setSelectedServerId(id);
      setActiveChannel(null);
      setShowStageSettings(false);
  };

  return (
    <div className="flex h-screen w-screen bg-dark-100 font-sans select-none overflow-hidden relative">
      
      {/* 1. SERVER LEISTE (Links) */}
      <div className="w-[72px] flex-shrink-0 z-50 relative border-r border-dark-400 bg-dark-400">
        <ServerRail 
            selectedServerId={selectedServerId} 
            onSelectServer={handleServerSelect} 
        />
      </div>

      {/* 2. LINKE SIDEBAR (Navigation) */}
      <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 z-40 bg-dark-200", showLeftSidebar ? "w-60 border-r border-dark-400" : "w-0 overflow-hidden border-none")}> 
        <div className="w-60 h-full">
           {selectedServerId ? (
               <ChannelSidebar 
                  serverId={selectedServerId}
                  activeChannelId={activeChannel?.id || null}
                  onSelectChannel={setActiveChannel}
               />
           ) : (
               <DashboardSidebar />
           )}
        </div>
      </div>
      
      {/* Toggle Button Links */}
      <button onClick={() => setShowLeftSidebar(!showLeftSidebar)} className="absolute top-1/2 z-50 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-all hover:scale-110" style={{ left: showLeftSidebar ? '300px' : '62px' }}>
        {showLeftSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* 3. MAIN SCREEN (Mitte) */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-dark-100 overflow-hidden">
        {selectedServerId ? (
            // SERVER MODUS
            activeChannel?.type === 'text' ? (
                <ChatChannelView channelName={activeChannel.name} />
            ) : (
                // VOICE / STAGE MODUS
                <div className="flex-1 flex items-center justify-center relative z-0">
                    <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                    
                    {/* Settings Icon */}
                    <div className="absolute top-4 right-4 z-20">
                        <button onClick={() => setShowStageSettings(!showStageSettings)} className="p-2 bg-black/40 text-gray-400 hover:text-white rounded hover:bg-black/60 transition-colors"><Settings size={20} /></button>
                        {showStageSettings && (
                            <div className="absolute top-10 right-0 w-48 bg-dark-200 border border-dark-400 shadow-xl rounded p-1 text-sm text-gray-300 animate-in fade-in zoom-in-95 duration-100">
                                <div className="p-2 hover:bg-dark-300 rounded cursor-pointer">Video Einstellungen</div>
                                <div className="p-2 hover:bg-dark-300 rounded cursor-pointer">Audio Einstellungen</div>
                                <div className="h-px bg-dark-400 my-1"></div>
                                <div className="p-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded cursor-pointer font-bold">Verbindung trennen</div>
                            </div>
                        )}
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-300 mb-2">{activeChannel ? `🔊 ${activeChannel.name}` : 'Stage Area'}</h2>
                        <p className="text-gray-500 mb-8">{activeChannel ? 'Verbunden.' : 'Wähle einen Voice-Channel links'}</p>
                        <div className="w-64 h-64 border-2 border-dashed border-gray-600 rounded-full mx-auto flex items-center justify-center text-gray-500 relative">
                             <span className="text-sm">3D Audio Radar</span>
                             {activeChannel && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse"></div>}
                        </div>
                    </div>
                </div>
            )
        ) : (
            // DASHBOARD MODUS (Freundesliste) - HIER WAR DER FEHLER
            <div className="flex-1 relative z-0 h-full">
                <FriendListStage />
            </div>
        )}
        <BottomChatBar />
      </div>

      {/* 4. RECHTE SIDEBAR (Mitglieder) */}
      {selectedServerId && (
        <>
            <div className={classNames("transition-all duration-300 ease-in-out relative flex flex-shrink-0 bg-dark-200 z-40 border-l border-dark-400", showRightSidebar ? "w-60" : "w-0 overflow-hidden")}>
                <div className="w-60 h-full">
                    {/* ECHTE DATEN LADEN */}
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