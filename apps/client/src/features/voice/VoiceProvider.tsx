import React, { useMemo } from 'react';
import { VoiceContext } from './state/VoiceContext';
import { VoiceStoreProvider, useVoiceStore } from './state/VoiceStore';
import { useVoiceEngine } from './engine/useVoiceEngine';

const VoiceComposer = ({ children }: { children: React.ReactNode }) => {
  const { state, setState } = useVoiceStore();
  const contextValue = useVoiceEngine({ state, setState });
  const memoizedValue = useMemo(() => contextValue, [contextValue]);

  return <VoiceContext.Provider value={memoizedValue}>{children}</VoiceContext.Provider>;
};

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => (
  <VoiceStoreProvider>
    <VoiceComposer>{children}</VoiceComposer>
  </VoiceStoreProvider>
);
