import { AuthScreen } from '../auth/AuthScreen';
import { CreateServerModal } from '../modals/CreateServerModal';
import { VoiceChannelView } from '../../features/voice/ui';

export const ScreenshotAuthScene = () => (
  <div className="min-h-screen w-full bg-[color:var(--color-background)] text-[color:var(--color-text)]">
    <AuthScreen onLoginSuccess={() => undefined} />
  </div>
);

export const ScreenshotModalScene = () => (
  <div className="min-h-screen w-full bg-[color:var(--color-background)] text-[color:var(--color-text)]">
    <CreateServerModal onClose={() => undefined} onCreated={() => undefined} />
  </div>
);

export const ScreenshotVoiceScene = () => (
  <div className="min-h-screen w-full bg-[color:var(--color-background)] text-[color:var(--color-text)]">
    <VoiceChannelView channelName="Voice Lounge" />
  </div>
);
