import { type VoiceConnectionHandle, type VoiceParticipant, type VoiceProviderId } from '../providers/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface VoiceNetworkStats {
  packetLossPercent: number | null;
  jitterMs: number | null;
  rttMs: number | null;
  updatedAt: number | null;
}

export interface VoiceState {
  providerId: VoiceProviderId | null;
  connectionHandle: VoiceConnectionHandle | null;
  activeChannelId: number | null;
  activeChannelName: string | null;
  connectionState: ConnectionState;
  error: string | null;
  cameraError: string | null;
  screenShareError: string | null;
  screenShareAudioError: string | null;
  participants: VoiceParticipant[];
  activeSpeakerIds: string[];
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
  token: string | null;
  localParticipantId: string | null;
  shareSystemAudio: boolean;
  outputVolume: number;
  localAudioLevel: number;
  networkStats: VoiceNetworkStats | null;
  connectedAt: number | null;
}

// UPDATE: Payload erlaubt jetzt auch eine Funktion (Functional Update)
export type VoiceAction =
  | { 
      type: 'patch'; 
      payload: Partial<VoiceState> | ((state: VoiceState) => Partial<VoiceState>) 
    }
  | { 
      type: 'reset'; 
      payload: VoiceState 
    };
