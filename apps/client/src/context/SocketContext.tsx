import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerPassword, getServerWebSocketUrl } from '../utils/apiConfig';
import { computeFingerprint, signMessage } from '../auth/identity';
import { storage } from '../shared/config/storage';

export interface ChannelPresenceUser {
  id: number;
  username: string;
  avatar_url?: string;
  status?: 'online' | 'offline';
  isSpeaking?: boolean;
}

export interface PresenceUserSnapshot {
  id: number;
  username: string;
  avatar_url?: string;
  avatar?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline';
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  channelPresence: Record<number, ChannelPresenceUser[]>;
  presenceSnapshot: Record<number, PresenceUserSnapshot>;
  optimisticLeave: (channelId: number, userId: number | string) => void;
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  isConnected: false, 
  channelPresence: {}, 
  presenceSnapshot: {},
  optimisticLeave: () => {}, 
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [channelPresence, setChannelPresence] = useState<Record<number, ChannelPresenceUser[]>>({});
  const [presenceSnapshot, setPresenceSnapshot] = useState<Record<number, PresenceUserSnapshot>>({});

  // FIX: Robuster Vergleich (String vs Number)
  const optimisticLeave = useCallback((channelId: number, userId: number | string) => {
    setChannelPresence((prev) => {
      const existing = prev[channelId];
      if (!existing) return prev;
      
      // Wir konvertieren beides zu String für den Vergleich, um "11" vs 11 Probleme zu vermeiden
      const targetId = String(userId);
      const filtered = existing.filter((u) => String(u.id) !== targetId);
      
      return { ...prev, [channelId]: filtered };
    });
  }, []);

  useEffect(() => {
    const identity = storage.get('identity');
    if (!identity) return;
    const setupSocket = async () => {
      const { signatureB64, timestamp } = await signMessage(identity, 'handshake');
      const socketInstance = io(getServerWebSocketUrl(), {
        auth: {
          fingerprint: computeFingerprint(identity),
          publicKey: identity.publicKeyB64,
          displayName: identity.displayName ?? null,
          serverPassword: getServerPassword(),
          signature: signatureB64,
          timestamp,
        },
      });

      socketInstance.on('connect', () => {
        console.log("Socket verbunden:", socketInstance.id);
        setIsConnected(true);
        socketInstance.emit('presence_ack');
      });

      socketInstance.on('disconnect', () => {
        console.log("Socket getrennt.");
        setIsConnected(false);
        setChannelPresence({});
        setPresenceSnapshot({});
      });

      socketInstance.on('presence_ping', () => {
        socketInstance.emit('presence_ack');
      });

      socketInstance.on('channel_presence_snapshot', ({ channelId, users }) => {
        setChannelPresence((prev) => ({ ...prev, [channelId]: users }));
      });

      socketInstance.on('channel_presence_join', ({ channelId, user }) => {
        setChannelPresence((prev) => {
          const existing = prev[channelId] || [];
          if (existing.some((u) => u.id === user.id)) return prev;
          return { ...prev, [channelId]: [...existing, user] };
        });
      });

      socketInstance.on('channel_presence_leave', ({ channelId, userId }) => {
        setChannelPresence((prev) => {
          const existing = prev[channelId] || [];
          return { ...prev, [channelId]: existing.filter((u) => u.id !== userId) };
        });
      });

      socketInstance.on('user_status_change', ({ userId, status }) => {
        setChannelPresence((prev) => {
          const next: Record<number, ChannelPresenceUser[]> = { ...prev };
          Object.entries(prev).forEach(([chId, users]) => {
            const updatedUsers = users.map((u) => (u.id === userId ? { ...u, status } : u));
            next[Number(chId)] = updatedUsers;
          });
          return next;
        });

        setPresenceSnapshot((prev) => {
          if (!prev[userId]) return prev;
          return { ...prev, [userId]: { ...prev[userId], status } };
        });
      });

      socketInstance.on('presence_snapshot', ({ users }) => {
        const normalized: Record<number, PresenceUserSnapshot> = {};
        (users || []).forEach((user: PresenceUserSnapshot) => {
          normalized[user.id] = user;
        });
        setPresenceSnapshot(normalized);
      });

      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
      };
    };

    const teardown = setupSocket();
    return () => {
      teardown.then((cleanup) => cleanup && cleanup()).catch(() => {});
    };
  }, [optimisticLeave]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, channelPresence, presenceSnapshot, optimisticLeave }}>
      {children}
    </SocketContext.Provider>
  );
};