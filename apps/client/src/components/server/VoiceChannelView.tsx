import { VideoConference, ControlBar } from '@livekit/components-react';
import { useVoice } from '../../context/voice-state';
import { Loader2 } from 'lucide-react';

export const VoiceChannelView = ({ channelId, channelName }: { channelId: number; channelName: string }) => {
  const { connectionState, activeChannelId } = useVoice();

  // Zeige Lade-Screen wenn wir auf den Channel geklickt haben, aber die Verbindung noch aufbaut
  if (connectionState !== 'connected' || activeChannelId !== channelId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-transparent text-gray-500 h-full">
         <Loader2 className="animate-spin mb-4 text-indigo-500" />
         <p>Verbinde mit {channelName}...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Das Grid mit den Videos */}
      <VideoConference />
      
      {/* Die Kontrollleiste unten */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
          <ControlBar variation="minimal" controls={{ leave: false, microphone: true, camera: true, screenShare: true }} />
      </div>
    </div>
  );
};