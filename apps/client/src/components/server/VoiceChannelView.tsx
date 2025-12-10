import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  VideoConference, 
  GridLayout, 
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
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
    // Wenn wir den Channel wechseln, Token zurücksetzen, damit neu geladen wird
    setToken('');
    
    const fetchToken = async () => {
      try {
        const auth = localStorage.getItem('clover_token');
        // Wir nutzen den Namen des Channels als Room-Name (sollte eigentlich channelId sein in Prod)
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
      <div className="flex-1 bg-dark-100 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4" size={32} />
        <h3 className="text-white font-bold">Verbinde mit "{channelName}"...</h3>
        <p className="text-sm">Bitte stelle sicher, dass der LiveKit Server läuft.</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false} // Startet ohne Kamera
      audio={true}  // Startet mit Mikrofon an
      token={token}
      // Falls VITE_LIVEKIT_URL nicht gesetzt ist, Fallback auf localhost
      serverUrl={import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880"} 
      data-lk-theme="default"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#313338' }}
      onDisconnected={() => setToken('')}
    >
      {/* Das Grid zeigt alle Teilnehmer */}
      <div className="flex-1 p-4 overflow-hidden relative">
         <MyVideoGrid />
      </div>

      {/* Kontrollleiste (Mute, Video, Share Screen, Auflegen) */}
      <ControlBar variation="minimal" controls={{ leave: false }} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
};

// Hilfskomponente für das Layout der Teilnehmer
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