import { createContext, useContext } from 'react';
import { Room } from 'livekit-client';

export interface VoiceContextType {
  activeRoom: Room | null;
  activeChannelId: number | null;
  activeChannelName: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  error: string | null;
  connectToChannel: (channelId: number, channelName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  token: string | null;
  muted: boolean;
  usePushToTalk: boolean;
  isTalking: boolean;
  setMuted: (muted: boolean) => Promise<void>;
  setPushToTalk: (enabled: boolean) => Promise<void>;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
}

export const VoiceContext = createContext<VoiceContextType | null>(null);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within a VoiceProvider');
  return context;
};