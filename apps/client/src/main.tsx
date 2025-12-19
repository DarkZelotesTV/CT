import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --------------------------------------------------------
// FÜGE DIESE ZEILE HINZU (Fix für schwarze Videos):
import '@livekit/components-styles'; 
import '@livekit/components-styles/prefabs'; // Optional, für bessere Layouts
// --------------------------------------------------------

import { IdentityGate } from './auth/IdentityGate';
import { SocketProvider } from './context/SocketContext.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceProvider } from './features/voice';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <IdentityGate>
    <SettingsProvider>
      <SocketProvider>
        <VoiceProvider>
          <App />
        </VoiceProvider>
      </SocketProvider>
    </SettingsProvider>
  </IdentityGate>
);
