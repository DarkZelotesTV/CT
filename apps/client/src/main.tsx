import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './theme/tempnew.css';

import { IdentityGate } from './auth/IdentityGate';
import { SocketProvider } from './context/SocketContext.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceProvider } from './features/voice';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { TopBarProvider } from './components/window/TopBarContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <TopBarProvider>
    <IdentityGate>
      <SettingsProvider>
        <SocketProvider>
          <VoiceProvider>
            <I18nextProvider i18n={i18n}>
              <App />
            </I18nextProvider>
          </VoiceProvider>
        </SocketProvider>
      </SettingsProvider>
    </IdentityGate>
  </TopBarProvider>,
);
