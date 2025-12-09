import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SocketProvider } from './context/SocketContext'; // Importieren

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // StrictMode macht bei Sockets manchmal Probleme (doppelte Verbindungen im Dev), 
  // kann man aber drin lassen oder rausnehmen.
  // <React.StrictMode> 
    <SocketProvider>
       <App />
    </SocketProvider>
  // </React.StrictMode>,
);