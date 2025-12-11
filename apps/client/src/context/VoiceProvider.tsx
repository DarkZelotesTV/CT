import React, { useState, useCallback, useRef } from 'react';
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

  // WICHTIG: Ref verhindert, dass React Effekte (Strict Mode) die Verbindung doppelt aufbauen
  const isConnecting = useRef(false);

  const disconnect = useCallback(async () => {
    // Sperre aufheben, falls wir gerade verbinden
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
    // 1. Abbruchbedingungen prüfen
    if (activeChannelId === channelId && connectionState === 'connected') {
      console.log("Bereits mit diesem Channel verbunden.");
      return;
    }
    if (isConnecting.current) {
      console.log("Verbindung wird bereits aufgebaut - breche ab.");
      return;
    }

    // Falls wir in einem anderen Raum sind -> sauber trennen
    if (activeRoom) {
      await activeRoom.disconnect();
    }

    // 2. Lock setzen und State updaten
    isConnecting.current = true;
    setConnectionState('connecting');
    setError(null);

    try {
      const auth = localStorage.getItem('clover_token');
      const roomName = `channel_${channelId}`;
      
      // Token vom Server holen
      const res = await axios.get(`${getServerUrl()}/api/livekit/token?room=${roomName}`, {
        headers: { Authorization: `Bearer ${auth}` }
      });
      
      const newToken = res.data.token;
      setToken(newToken);

      // Raum-Instanz erstellen
      const room = new Room({
         adaptiveStream: true,
         dynacast: true,
         publishDefaults: {
            simulcast: true,
         },
         rtcConfig: {
            // Im lokalen Docker Netzwerk ist dies oft nötig
            iceServers: [], 
         }
      });

      // Event Listener registrieren
      room.on(RoomEvent.Disconnected, () => {
          console.log("Room disconnected");
          setConnectionState('disconnected');
          setActiveRoom(null);
          setActiveChannelId(null);
          setActiveChannelName(null);
          isConnecting.current = false;
      });
      
      room.on(RoomEvent.Connected, () => {
          console.log("Room connected successfully!");
          setConnectionState('connected');
          isConnecting.current = false;
      });

      room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => setConnectionState('connected'));

      // 3. Tatsächliche Verbindung aufbauen
      const wsUrl = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";
      await room.connect(wsUrl, newToken);
      
      // State erst setzen, wenn Verbindung steht
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