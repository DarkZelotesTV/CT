import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerUrl } from '../utils/apiConfig';

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
    const token = localStorage.getItem('clover_token');
    const userStr = localStorage.getItem('clover_user');
    
    if (!token || !userStr) return;

    const user = JSON.parse(userStr);

    // Verbindung aufbauen
    const socketInstance = io(getServerUrl(), {
      query: { userId: user.id }, // Wir sagen dem Server, wer wir sind (für Online-Status)
      auth: { token }
    });

    socketInstance.on('connect', () => {
      console.log("Socket verbunden:", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log("Socket getrennt");
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};