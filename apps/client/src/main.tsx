import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SocketProvider } from './context/SocketContext.tsx'
import { VoiceProvider } from './context/VoiceProvider'; // NEU: Import aus der neuen Datei

ReactDOM.createRoot(document.getElementById('root')!).render(
    <SocketProvider>
      <VoiceProvider> 
        <App />
      </VoiceProvider>
    </SocketProvider>
)