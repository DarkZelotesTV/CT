import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { getServerPassword, getServerWebSocketUrl } from '../utils/apiConfig';
import { computeFingerprint, signMessage } from '../auth/identity';
import { storage } from '../shared/config/storage';
// NOTE: `@discord-clone/shared` currently builds to CJS and re-exports via `__exportStar`.
// Vite/Rollup can fail to detect `socketEvents` as a named export through that re-export.
// Runtime constant from the TS source so Vite/Rollup doesn't have to guess CommonJS named exports.
// (Types stay imported from the package root.)
import type { TypedSocket, PresenceUserSnapshot, ChannelPresenceUser } from '@discord-clone/shared';
import { socketEvents } from '../../../../packages/shared/src/socket-events';

interface SocketContextType {
  socket: TypedSocket | null;
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
  const [socket, setSocket] = useState<TypedSocket | null>(null);
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
      const socketInstance: TypedSocket = io(getServerWebSocketUrl(), {
        auth: {
          fingerprint: computeFingerprint(identity),
          publicKey: identity.publicKeyB64,
          displayName: identity.displayName ?? null,
          serverPassword: getServerPassword(),
          signature: signatureB64,
          timestamp,
        },
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 8000,
      });

      const safeEmit = (event: any, ...args: any[]) => {
        if (!socketInstance.connected) socketInstance.connect();
        socketInstance.emit(event, ...(args as any));
      };

      const registerCoreHandlers = () => {
        // Socket.IO's `.on()` is strongly typed by event name. In some TS resolution
        // modes, `socketEvents.*` can get widened to `string`, which breaks overload
        // selection. Using explicit literals keeps strict builds happy.
        socketInstance.on('presence_ping', () => {
          safeEmit(socketEvents.presenceAck);
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

        socketInstance.io.on('reconnect_attempt', () => {
          console.debug('[socket] reconnect attempt');
        });

        socketInstance.io.on('reconnect_error', (err: any) => {
          console.warn('[socket] reconnect error', err?.message || err);
        });

        socketInstance.io.on('reconnect_failed', () => {
          console.error('[socket] reconnect failed, giving up');
        });

        socketInstance.on('connect', () => {
          console.log('Socket verbunden:', socketInstance.id);
          setIsConnected(true);
          safeEmit(socketEvents.presenceAck);
        });

        socketInstance.on('connect_error', (err: any) => {
          console.warn('[socket] connect error', err?.message || err);
        });

        socketInstance.on('disconnect', (reason: string) => {
          console.log('Socket getrennt.', reason);
          setIsConnected(false);
          setChannelPresence({});
          setPresenceSnapshot({});
          if (reason === 'io server disconnect') {
            socketInstance.connect();
          }
        });
      };

      registerCoreHandlers();
      socketInstance.connect();
      setSocket(socketInstance);

      return () => {
        socketInstance.removeAllListeners();
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
