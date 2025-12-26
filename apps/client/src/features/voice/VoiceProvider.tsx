import React, { useMemo } from 'react';
import { useVoiceEngine } from './engine';
import { type VoiceProviderId } from './providers/types';
import { VoiceContext, type VoiceContextType } from './state/VoiceContext';
import { VoiceStoreProvider, useVoiceStore } from './state';

const useVoiceComposer = (): VoiceContextType => {
  const { state, setState } = useVoiceStore();
  const providerKey = ((import.meta as any)?.env?.VITE_VOICE_PROVIDER as VoiceProviderId) ?? 'livekit';
  const providerFactories: Record<string, typeof useVoiceEngine> = {
    livekit: useVoiceEngine,
  };
  const selectedFactory = providerFactories[providerKey] ?? useVoiceEngine;
  const engineContext = selectedFactory({ state, setState });

  return useMemo(() => engineContext, [engineContext]);
};

const VoiceComposer = ({ children }: { children: React.ReactNode }) => {
  const contextValue = useVoiceComposer();
  const ProviderWrapper = contextValue.providerRenderers.ProviderWrapper ?? React.Fragment;
  return (
    <VoiceContext.Provider value={contextValue}>
      <ProviderWrapper>{children}</ProviderWrapper>
    </VoiceContext.Provider>
  );
};

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => (
  <VoiceStoreProvider>
    <VoiceComposer>{children}</VoiceComposer>
  </VoiceStoreProvider>
);
