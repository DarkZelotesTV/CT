import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { IdentityGate } from './auth/IdentityGate';
import { SocketProvider } from './context/SocketContext.tsx';
import { VoiceProvider } from './context/VoiceProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <IdentityGate>
    <SocketProvider>
      <VoiceProvider>
        <App />
      </VoiceProvider>
    </SocketProvider>
  </IdentityGate>
);
