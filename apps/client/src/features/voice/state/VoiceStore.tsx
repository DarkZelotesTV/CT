import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { voiceReducer } from './voiceReducer';
import { VoiceState } from './voiceTypes';

const VoiceStateContext = createContext<VoiceState | null>(null);
const VoiceDispatchContext = createContext<React.Dispatch<any> | null>(null);

const createInitialState = (settings: ReturnType<typeof useSettings>['settings']): VoiceState => ({
  activeRoom: null,
  activeChannelId: null,
  activeChannelName: null,
  connectionState: 'disconnected',
  error: null,
  cameraError: null,
  screenShareError: null,
  screenShareAudioError: null,
  muted: settings.talk.muted,
  micMuted: settings.talk.micMuted,
  usePushToTalk: settings.talk.pushToTalkEnabled,
  isTalking: false,
  isCameraEnabled: false,
  isScreenSharing: false,
  isPublishingCamera: false,
  isPublishingScreen: false,
  rnnoiseEnabled: settings.talk.rnnoiseEnabled ?? false,
  rnnoiseAvailable: true,
  rnnoiseError: null,
  token: null,
  localParticipantId: null,
  shareSystemAudio: false,
  outputVolume: typeof settings.talk.outputVolume === 'number' ? settings.talk.outputVolume : 1,
  localAudioLevel: 0,
});

export const VoiceStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const settingsContext = useSettings();
  const [state, dispatch] = useReducer(voiceReducer, settingsContext.settings, createInitialState);

  const setters = useMemo(
    () => ({
      setState: (patch: Partial<VoiceState> | ((prev: VoiceState) => Partial<VoiceState>)) =>
        dispatch({
          type: 'patch',
          payload: patch, // Die Payload wird nun direkt an den Reducer gereicht
        }),
    }),
    [dispatch] // FIX: Nur noch von dispatch abhängig, damit die Referenz stabil bleibt
  );

  return (
    <VoiceStateContext.Provider value={state}>
      <VoiceDispatchContext.Provider value={dispatch}>
        <VoiceStoreHelpersContext.Provider value={setters}>{children}</VoiceStoreHelpersContext.Provider>
      </VoiceDispatchContext.Provider>
    </VoiceStateContext.Provider>
  );
};

const VoiceStoreHelpersContext = createContext<{
  setState: (patch: Partial<VoiceState> | ((prev: VoiceState) => Partial<VoiceState>)) => void;
} | null>(null);

export const useVoiceState = () => {
  const ctx = useContext(VoiceStateContext);
  if (!ctx) throw new Error('useVoiceState must be used inside VoiceStoreProvider');
  return ctx;
};

export const useVoiceDispatch = () => {
  const ctx = useContext(VoiceDispatchContext);
  if (!ctx) throw new Error('useVoiceDispatch must be used inside VoiceStoreProvider');
  return ctx;
};

export const useVoiceSetters = () => {
  const ctx = useContext(VoiceStoreHelpersContext);
  if (!ctx) throw new Error('useVoiceSetters must be used inside VoiceStoreProvider');
  return ctx;
};

export const useVoiceStore = () => {
  const state = useVoiceState();
  const dispatch = useVoiceDispatch();
  const { setState } = useVoiceSetters();

  return { state, dispatch, setState };
};