import React, { useMemo } from 'react';
import { useVoiceEngine } from './engine';
import { VoiceContext, type VoiceContextType } from './state/VoiceContext';
import { VoiceStoreProvider, useVoiceStore } from './state';

const useVoiceComposer = (): VoiceContextType => {
  const { state, setState } = useVoiceStore();
  const engineContext = useVoiceEngine({ state, setState });

  return useMemo(() => engineContext, [engineContext]);
};

const VoiceComposer = ({ children }: { children: React.ReactNode }) => {
  const contextValue = useVoiceComposer();
  return <VoiceContext.Provider value={contextValue}>{children}</VoiceContext.Provider>;
};

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => (
  <VoiceStoreProvider>
    <VoiceComposer>{children}</VoiceComposer>
  </VoiceStoreProvider>
);
