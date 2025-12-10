import { useState, useRef } from 'react';
import classNames from 'classnames';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ServerRail } from './ServerRail';
import { BottomChatBar, BottomChatBarRef } from './BottomChatBar';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';

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
    <div className="flex h-screen w-screen overflow-hidden relative bg-[#050507] text-gray-200 font-sans">
      
      {/* 1. SERVER RAIL (Schwebend Links) */}
      <div className="w-[80px] flex-shrink-0 z-50 flex flex-col items-center py-3 h-full">
         <div className="w-full h-full bg-[#0a0a0c]/80 backdrop-blur-xl rounded-2xl border border-white/5 ml-3 shadow-2xl">
            <ServerRail 
                selectedServerId={selectedServerId} 
                onSelectServer={handleServerSelect} 
            />
         </div>
      </div>

      {/* 2. CHANNEL SIDEBAR (Links) */}
      <div 
        className={classNames(
          "transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pl-3", 
          showLeftSidebar ? "w-64 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10 pl-0"
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
               />
           ) : (
               <DashboardSidebar />
           )}
        </div>
      </div>

      {/* 3. HAUPT-BÜHNE (Mitte, Zentriert) */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full py-3 px-3 overflow-hidden">
        
        {/* Toggle Button LINKS (Mittig am Rand des Fensters) */}
        <button 
           onClick={() => setShowLeftSidebar(!showLeftSidebar)} 
           className="absolute left-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-r-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
        >
          {showLeftSidebar ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
        </button>

        {/* Das eigentliche Fenster */}
        <div className="flex-1 bg-[#09090b] rounded-2xl border border-white/5 relative overflow-hidden shadow-2xl">
            
            {selectedServerId ? (
                activeChannel?.type === 'web' ? (
                    <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
                ) : activeChannel?.type === 'voice' ? (
                    <VoiceChannelView channelId={activeChannel.id} channelName={activeChannel.name} />
                ) : (
                    <div className="flex-1 flex items-center justify-center h-full relative">
                        {/* Hintergrund Gitter */}
                        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                        
                        <div className="text-center p-12 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
                            <h2 className="text-2xl font-bold text-white mb-2">Stage Area</h2>
                            <p className="text-gray-500 text-sm">Wähle einen Kanal links.</p>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex-1 relative h-full">
                    <FriendListStage />
                </div>
            )}

            <BottomChatBar ref={chatBarRef} />
        </div>

        {/* Toggle Button RECHTS (Mittig am Rand) */}
        {selectedServerId && (
            <button 
                onClick={() => setShowRightSidebar(!showRightSidebar)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-l-xl backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg"
            >
              {showRightSidebar ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            </button>
        )}

      </div>

      {/* 4. MEMBER SIDEBAR (Rechts) */}
      {selectedServerId && (
        <div 
          className={classNames(
            "transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pr-3", 
            showRightSidebar ? "w-64 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-10 pr-0"
          )}
        >
            <div className="w-full h-full bg-[#0e0e11]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <MemberSidebar serverId={selectedServerId} />
            </div>
        </div>
      )}

    </div>
  );
};