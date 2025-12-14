import { createContext, useContext } from 'react';
import { Room } from 'livekit-client';

export interface VoiceContextType {
  activeRoom: Room | null;
  activeChannelId: number | null;
  activeChannelName: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  error: string | null;
  cameraError: string | null;
  screenShareError: string | null;
  connectToChannel: (channelId: number, channelName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  token: string | null;
  muted: boolean;
  micMuted: boolean;
  usePushToTalk: boolean;
  isTalking: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isPublishingCamera: boolean;
  isPublishingScreen: boolean;
  setMuted: (muted: boolean) => Promise<void>;
  setMicMuted: (muted: boolean) => Promise<void>;
  setPushToTalk: (enabled: boolean) => Promise<void>;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;
  startCamera: (quality?: 'low' | 'medium' | 'high') => Promise<void>;
  stopCamera: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  selectedVideoInputId: string | null;
  localParticipantId: string | null;
}

export const VoiceContext = createContext<VoiceContextType | null>(null);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within a VoiceProvider');
  return context;
};
