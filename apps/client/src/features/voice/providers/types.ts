import React from 'react';
import type { VoiceState } from '../state/voiceTypes';

export type VoiceProviderId = 'mediasoup' | 'p2p' | (string & {});

export type VoiceConnectionHandle = {
  provider: VoiceProviderId;
  sessionId: string;
  meta?: Record<string, unknown>;
};

export type VoiceDevicePreferences = {
  audioInputId: string | null;
  audioOutputId: string | null;
  videoInputId: string | null;
};

export type VoiceParticipant = {
  id: string;
  name: string;
  isLocal: boolean;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
  metadata?: string | null;
};

export type VoiceStats = {
  localAudioLevel: number;
};

export type VoiceMediaStageProps = {
  layout: 'grid' | 'speaker';
  floatingScreenShare?: boolean;
  onRequestAnchor?: () => void;
  participants: VoiceParticipant[];
  activeSpeakerIds: string[];
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  nativeHandle?: unknown;
};

export type VoiceProviderRenderers = {
  MediaStage?: React.ComponentType<VoiceMediaStageProps>;
  AudioRenderer?: React.ComponentType;
  DebugOverlay?: React.ComponentType;
  ProviderWrapper?: React.ComponentType<{ children: React.ReactNode }>;
};

export type VoiceConnectRequest = {
  channelId: number;
  channelName: string;
};

export type VoiceFallbackRequest = {
  providerId: VoiceProviderId;
  targetProviderId?: VoiceProviderId;
  channelId?: number;
  channelName?: string;
  reason?: string;
};

export type VoiceEngineDeps = {
  state: VoiceState;
  setState: (patch: Partial<VoiceState> | ((prev: VoiceState) => Partial<VoiceState>)) => void;
  providerId?: VoiceProviderId;
  fallbackProviderId?: VoiceProviderId;
  requestFallback?: (request: VoiceFallbackRequest) => void;
  initialConnectRequest?: VoiceConnectRequest | null;
};

export interface VoiceProviderAdapter {
  // Provider id can be null while no provider is connected.
  providerId: VoiceProviderId | null;
  getNativeHandle?: () => unknown;
  connectToChannel: (channelId: number, channelName: string, options?: { isReconnect?: boolean }) => Promise<void>;
  disconnect: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  setMicMuted: (muted: boolean) => Promise<void>;
  setPushToTalk: (enabled: boolean) => Promise<void>;
  setRnnoiseEnabled: (enabled: boolean) => Promise<void>;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;
  startCamera: (quality?: 'low' | 'medium' | 'high') => Promise<void>;
  stopCamera: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  startScreenShare: (
    options?: {
      sourceId?: string;
      quality?: 'low' | 'medium' | 'high' | 'native';
      frameRate?: number | 'native';
      track?: MediaStreamTrack;
      withAudio?: boolean;
      bitrateProfile?: 'low' | 'medium' | 'high' | 'max';
    }
  ) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setShareSystemAudio: React.Dispatch<React.SetStateAction<boolean>>;
  setDevicePreferences?: (prefs: Partial<VoiceDevicePreferences>) => Promise<void>;
  setOutputVolume: (volume: number) => Promise<void> | void;
  setParticipantVolume?: (participantId: string, volume: number) => void;
}
