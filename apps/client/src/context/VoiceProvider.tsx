import React, { useState, useCallback, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { getLiveKitConfig } from '../utils/apiConfig';
import { VoiceContext, VoiceContextType } from './voice-state';
import { apiFetch } from '../api/http';

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<VoiceContextType['connectionState']>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const isConnecting = useRef(false);
  const attemptRef = useRef(0);

  const disconnect = useCallback(async () => {
  console.warn('[voice] disconnect() called', new Error().stack);
    isConnecting.current = false;
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
    const attempt = ++attemptRef.current;
    if (activeChannelId === channelId && connectionState === 'connected') return;
    if (isConnecting.current) return;

    if (activeRoom) {
      await activeRoom.disconnect();
    }

    isConnecting.current = true;
    setConnectionState('connecting');
    setError(null);

    try {
      const lkConfig = getLiveKitConfig(); // Config laden
      const roomName = `channel_${channelId}`;

      const res = await apiFetch<{ token: string }>(`/api/livekit/token?room=${roomName}`);
      const newToken = res.token;
      setToken(newToken);

      // Room Instanz mit den konfigurierten ICE-Servern erstellen
      const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      useSinglePeerConnection: true,
      publishDefaults: { simulcast: true },
      rtcConfig: lkConfig.connectOptions.rtcConfig,
      });


      room.on(RoomEvent.Disconnected, (reason) => {
          console.warn('[voice] Room disconnected', reason);
          setConnectionState('disconnected');
          setActiveRoom(null);
          setActiveChannelId(null);
          setActiveChannelName(null);
          isConnecting.current = false;
      });
      
      room.on(RoomEvent.Connected, () => {
          setConnectionState('connected');
          isConnecting.current = false;
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.warn('[voice] ConnectionState', state);
      });

      room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => setConnectionState('connected'));
      room.on(RoomEvent.Reconnecting, () => console.warn('[voice] Reconnecting'));
      room.on(RoomEvent.Reconnected, () => console.warn('[voice] Reconnected'));

      // Verbinden mit der sicheren URL
      await room.connect(lkConfig.serverUrl, newToken);
        if (attemptRef.current !== attempt) {
          room.disconnect();
        return;
        }
      await room.localParticipant.setMicrophoneEnabled(true);
      
      setActiveRoom(room);
      setActiveChannelId(channelId);
      setActiveChannelName(channelName);
      
    } catch (err: any) {
      console.error("Voice Connection Failed:", err);
      setError(err.message || 'Verbindung fehlgeschlagen');
      setConnectionState('disconnected');
      isConnecting.current = false;
    }
  }, [activeChannelId, activeRoom, connectionState]); 

  return (
    <VoiceContext.Provider value={{ 
        activeRoom, activeChannelId, activeChannelName,
        connectionState, error, connectToChannel, disconnect, token
    }}>
      {children}
    </VoiceContext.Provider>
  );
};