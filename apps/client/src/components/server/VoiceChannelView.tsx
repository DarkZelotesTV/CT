import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  VideoConference, 
  GridLayout, 
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
  DisconnectButton
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { getServerUrl } from '../../utils/apiConfig';

interface VoiceChannelViewProps {
  channelId: number;
  channelName: string;
}

export const VoiceChannelView = ({ channelId, channelName }: VoiceChannelViewProps) => {
  const [token, setToken] = useState('');

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const auth = localStorage.getItem('clover_token');
        // Wir nutzen den Namen des Channels als Room-Name (eindeutiger wäre channelId)
        const roomName = `channel_${channelId}`;
        
        const res = await axios.get(`${getServerUrl()}/api/livekit/token?room=${roomName}`, {
          headers: { Authorization: `Bearer ${auth}` }
        });
        setToken(res.data.token);
      } catch (err) {
        console.error("Konnte Voice-Token nicht laden", err);
      }
    };
    fetchToken();
  }, [channelId]);

  if (!token) {
    return (
      <div className="flex-1 bg-dark-400 flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mr-2" /> Verbinde mit Audio-Server...
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false} // Startet ohne Kamera
      audio={true}  // Startet mit Mikrofon an
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880"} // Deine LiveKit URL
      data-lk-theme="default"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111214' }}
      onDisconnected={() => setToken('')}
    >
      {/* Das Grid zeigt alle Teilnehmer (Video oder Avatar) */}
      <div className="flex-1 p-4 overflow-hidden relative">
         <MyVideoGrid />
      </div>

      {/* Kontrollleiste (Mute, Video, Share Screen, Auflegen) */}
      <ControlBar variation="minimal" controls={{ leave: false }} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
};

// Hilfskomponente für das Layout
function MyVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}