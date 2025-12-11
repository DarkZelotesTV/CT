import { LiveKitRoom, VideoConference, ControlBar } from '@livekit/components-react';
import { useVoice } from '../../context/voice-state';
import { Loader2 } from 'lucide-react';
import '@livekit/components-styles'; // CSS Styles sind essenziell!

export const VoiceChannelView = ({ channelId, channelName }: { channelId: number; channelName: string }) => {
  const { connectionState, activeChannelId, activeRoom, token } = useVoice();

  // Solange wir verbinden oder kein Raum da ist -> Ladebildschirm
  if (connectionState !== 'connected' || activeChannelId !== channelId || !activeRoom || !token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-transparent text-gray-500 h-full">
         <Loader2 className="animate-spin mb-4 text-indigo-500" />
         <p>Verbinde mit {channelName}...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col bg-gray-900" style={{ minHeight: '400px' }}>
      {/* connect={false} -> WICHTIG: LiveKitRoom soll nicht selbst verbinden.
        room={activeRoom} -> Wir übergeben unseren manuell erstellten Raum.
      */}
      <LiveKitRoom
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880"}
        room={activeRoom}
        connect={false} 
        data-lk-theme="default"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex-1 relative">
            <VideoConference />
        </div>
        
        <div className="h-16 flex items-center justify-center bg-gray-800 border-t border-gray-700 p-2">
            <ControlBar 
              variation="minimal" 
              controls={{ leave: false, microphone: true, camera: true, screenShare: true, chat: false }} 
            />
        </div>
      </LiveKitRoom>
    </div>
  );
};