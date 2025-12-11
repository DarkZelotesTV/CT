import { useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import axios from 'axios';
import { getServerUrl } from '../utils/apiConfig';
import { VoiceContext, VoiceContextType } from './voice-state';

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<VoiceContextType['connectionState']>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(async () => {
    if (activeRoom) {
      await activeRoom.disconnect();
    }
    setActiveRoom(null);
    setActiveChannelId(null);
    setActiveChannelName(null);
    setToken(null);
    setConnectionState('disconnected');
  }, [activeRoom]);

  const connectToChannel = useCallback(async (channelId: number, channelName: string) => {
    if (activeChannelId === channelId && connectionState === 'connected') return;
    if (activeRoom) await disconnect();

    setConnectionState('connecting');
    setError(null);

    try {
      const auth = localStorage.getItem('clover_token');
      const roomName = `channel_${channelId}`;
      
      const res = await axios.get(`${getServerUrl()}/api/livekit/token?room=${roomName}`, {
        headers: { Authorization: `Bearer ${auth}` }
      });
      
      const newToken = res.data.token;
      setToken(newToken);

      // Raum erstellen (STRIKT lokal)
      const room = new Room({
         adaptiveStream: true,
         dynacast: true,
         rtcConfig: {
            iceServers: [], 
            iceTransportPolicy: 'all',
         }
      });

      room.on(RoomEvent.Disconnected, () => {
          setConnectionState('disconnected');
          setActiveRoom(null);
          setActiveChannelId(null);
          setActiveChannelName(null);
      });
      room.on(RoomEvent.Connected, () => setConnectionState('connected'));
      room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => setConnectionState('connected'));

      const wsUrl = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";
      await room.connect(wsUrl, newToken);
      
      setActiveRoom(room);
      setActiveChannelId(channelId);
      setActiveChannelName(channelName);
      
    } catch (err: any) {
      console.error("Voice Connection Failed:", err);
      setError(err.message || 'Verbindung fehlgeschlagen');
      setConnectionState('disconnected');
    }
  }, [activeChannelId, activeRoom, disconnect, connectionState]);

  return (
    <VoiceContext.Provider value={{ 
        activeRoom, activeChannelId, activeChannelName,
        connectionState, error, connectToChannel, disconnect, token
    }}>
      {children}
    </VoiceContext.Provider>
  );
};