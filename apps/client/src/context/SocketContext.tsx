import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerPassword, getServerUrl } from '../utils/apiConfig';
import { computeFingerprint, signMessage } from '../auth/identity';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const rawIdentity = localStorage.getItem('ct.identity.v1');
    if (!rawIdentity) return;

    const identity = JSON.parse(rawIdentity);
    const setupSocket = async () => {
      const { signatureB64, timestamp } = await signMessage(identity, 'handshake');
      const socketInstance = io(getServerUrl(), {
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
      });

      socketInstance.on('disconnect', () => {
        console.log("Socket getrennt.");
        setIsConnected(false);
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
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
