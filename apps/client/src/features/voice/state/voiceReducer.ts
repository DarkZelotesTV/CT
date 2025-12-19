import { VoiceAction, VoiceState } from './voiceTypes';

export const voiceReducer = (state: VoiceState, action: VoiceAction): VoiceState => {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.payload };
    case 'reset':
      return action.payload;
    default:
      return state;
  }
};
