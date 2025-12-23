import { VoiceAction, VoiceState } from './voiceTypes';

export const voiceReducer = (state: VoiceState, action: VoiceAction): VoiceState => {
  switch (action.type) {
    case 'patch':
      const patch = typeof action.payload === 'function' 
        ? action.payload(state) 
        : action.payload;
      return { ...state, ...patch };
    case 'reset':
      return action.payload;
    default:
      return state;
  }
};