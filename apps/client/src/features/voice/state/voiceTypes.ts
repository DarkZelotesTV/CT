import { Room } from 'livekit-client';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface VoiceState {
  activeRoom: Room | null;
  activeChannelId: number | null;
  activeChannelName: string | null;
  connectionState: ConnectionState;
  error: string | null;
  cameraError: string | null;
  screenShareError: string | null;
  screenShareAudioError?: string | null;
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
}

export type VoiceAction =
  | { type: 'patch'; payload: Partial<VoiceState> }
  | { type: 'reset'; payload: VoiceState };
