import { renderHook } from '@testing-library/react';
import { VoiceContext, type VoiceContextType, useVoice } from './VoiceContext';

const createMockVoiceContext = (): VoiceContextType => ({
  providerId: 'livekit',
  connectionHandle: null,
  activeChannelId: null,
  activeChannelName: null,
  connectionState: 'disconnected',
  error: null,
  cameraError: null,
  screenShareError: null,
  participants: [],
  activeSpeakerIds: [],
  getNativeHandle: vi.fn(),
  connectToChannel: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  token: null,
  muted: false,
  micMuted: false,
  usePushToTalk: false,
  isTalking: false,
  isCameraEnabled: false,
  isScreenSharing: false,
  isPublishingCamera: false,
  isPublishingScreen: false,
  rnnoiseEnabled: false,
  rnnoiseAvailable: false,
  rnnoiseError: null,
  setMuted: vi.fn(async () => {}),
  setMicMuted: vi.fn(async () => {}),
  setPushToTalk: vi.fn(async () => {}),
  setRnnoiseEnabled: vi.fn(async () => {}),
  startTalking: vi.fn(async () => {}),
  stopTalking: vi.fn(async () => {}),
  startCamera: vi.fn(async () => {}),
  stopCamera: vi.fn(async () => {}),
  toggleCamera: vi.fn(async () => {}),
  startScreenShare: vi.fn(async () => {}),
  stopScreenShare: vi.fn(async () => {}),
  toggleScreenShare: vi.fn(async () => {}),
  shareSystemAudio: false,
  setShareSystemAudio: vi.fn(),
  setParticipantVolume: vi.fn(),
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  selectedVideoInputId: null,
  localParticipantId: null,
  outputVolume: 1,
  setOutputVolume: vi.fn(),
  screenShareAudioError: null,
  localAudioLevel: 0,
});

describe('useVoice', () => {
  it('throws an error when used outside the provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useVoice())).toThrowError('useVoice must be used within a VoiceProvider');

    consoleErrorSpy.mockRestore();
  });

  it('returns the provided context when inside a provider', () => {
    const contextValue = createMockVoiceContext();
    const { result } = renderHook(() => useVoice(), {
      wrapper: ({ children }) => <VoiceContext.Provider value={contextValue}>{children}</VoiceContext.Provider>,
    });

    expect(result.current).toBe(contextValue);
  });
});
