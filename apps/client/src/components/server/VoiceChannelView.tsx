import { LiveKitRoom, VideoConference, ControlBar } from '@livekit/components-react';
import { useVoice } from '../../context/voice-state';
import { Loader2 } from 'lucide-react';
import { getLiveKitConfig } from '../../utils/apiConfig';
import '@livekit/components-styles';

export const VoiceChannelView = ({ channelId, channelName }: { channelId: number; channelName: string }) => {
  // Wir holen ALLES aus dem Context, kein eigenes Token-Fetching mehr hier!
  const { connectionState, activeChannelId, activeRoom, token } = useVoice();
  const lkConfig = getLiveKitConfig();

  // Warten bis der Provider verbunden hat
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
      <LiveKitRoom
        token={token}
        serverUrl={lkConfig.serverUrl}
        room={activeRoom}
        connect={false} // WICHTIG: Der Provider hat schon connected!
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