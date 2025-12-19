import { VoiceState } from './voiceTypes';

export const selectConnectionState = (state: VoiceState) => state.connectionState;
export const selectActiveChannel = (state: VoiceState) => ({
  id: state.activeChannelId,
  name: state.activeChannelName,
});
export const selectErrors = (state: VoiceState) => ({
  error: state.error,
  cameraError: state.cameraError,
  screenShareError: state.screenShareError,
  screenShareAudioError: state.screenShareAudioError ?? null,
  rnnoiseError: state.rnnoiseError,
});
export const selectMediaState = (state: VoiceState) => ({
  muted: state.muted,
  micMuted: state.micMuted,
  usePushToTalk: state.usePushToTalk,
  isTalking: state.isTalking,
  isCameraEnabled: state.isCameraEnabled,
  isScreenSharing: state.isScreenSharing,
  isPublishingCamera: state.isPublishingCamera,
  isPublishingScreen: state.isPublishingScreen,
  rnnoiseEnabled: state.rnnoiseEnabled,
  rnnoiseAvailable: state.rnnoiseAvailable,
  shareSystemAudio: state.shareSystemAudio,
  outputVolume: state.outputVolume,
});
