import { createContext, useContext } from 'react';
import { ConnectionState } from './voiceTypes';
import { type VoiceConnectionHandle, type VoiceParticipant, type VoiceProviderAdapter, type VoiceProviderId } from '../providers/types';

export interface VoiceContextType extends VoiceProviderAdapter {
  providerId: VoiceProviderId | null;
  connectionHandle: VoiceConnectionHandle | null;
  activeChannelId: number | null;
  activeChannelName: string | null;
  connectionState: ConnectionState;
  error: string | null;
  cameraError: string | null;
  screenShareError: string | null;
  participants: VoiceParticipant[];
  activeSpeakerIds: string[];
  token: string | null;
  muted: boolean;
  micMuted: boolean;
  usePushToTalk: boolean;
  isTalking: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isPublishingCamera: boolean;
  isPublishingScreen: boolean;
  rnnoiseEnabled: boolean;
  rnnoiseAvailable: boolean;
  rnnoiseError: string | null;
  setMuted: (muted: boolean) => Promise<void>;
  setMicMuted: (muted: boolean) => Promise<void>;
  setPushToTalk: (enabled: boolean) => Promise<void>;
  setRnnoiseEnabled: (enabled: boolean) => Promise<void>;
  shareSystemAudio: boolean;
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  selectedVideoInputId: string | null;
  localParticipantId: string | null;
  outputVolume: number;
  screenShareAudioError?: string | null;
  localAudioLevel: number;
}

export const VoiceContext = createContext<VoiceContextType | null>(null);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within a VoiceProvider');
  return context;
};
