import React, { useMemo } from 'react';
import { useVoiceEngine, type VoiceEngineDeps } from './engine';
import { useMediasoupProvider } from './providers/mediasoup/MediasoupProvider';
import { type VoiceProviderId } from './providers/types';
import { VoiceContext, type VoiceContextType } from './state/VoiceContext';
import { VoiceStoreProvider, useVoiceStore } from './state';

type VoiceProviderFactory = (deps: VoiceEngineDeps) => VoiceContextType;
type VoiceProviderRegistry = Partial<Record<VoiceProviderId, VoiceProviderFactory>>;

const livekitFactory: VoiceProviderFactory = (deps) => useVoiceEngine({ ...deps, providerId: 'livekit' });
const mediasoupFactory: VoiceProviderFactory = (deps) => useMediasoupProvider({ ...deps, providerId: 'mediasoup' });
const p2pFactory: VoiceProviderFactory = (deps) => useVoiceEngine({ ...deps, providerId: 'p2p' });

const defaultProviderFactories: Record<VoiceProviderId, VoiceProviderFactory> = {
  livekit: livekitFactory,
  mediasoup: mediasoupFactory,
  p2p: p2pFactory,
};

type VoiceProviderConfig = {
  providerId?: VoiceProviderId;
  fallbackProviderId?: VoiceProviderId;
  providerFactories?: VoiceProviderRegistry;
};

const resolveProviderId = (config: VoiceProviderConfig): VoiceProviderId => {
  const envProvider = (import.meta as any)?.env?.VITE_VOICE_PROVIDER as VoiceProviderId | undefined;
  return config.providerId ?? envProvider ?? config.fallbackProviderId ?? 'livekit';
};

const useVoiceComposer = (config: VoiceProviderConfig): VoiceContextType => {
  const { state, setState } = useVoiceStore();

  const providerKey = resolveProviderId(config);
  const fallbackKey = config.fallbackProviderId ?? 'livekit';

  const registry = useMemo(
    () => ({
      ...defaultProviderFactories,
      ...(config.providerFactories ?? {}),
    }),
    [config.providerFactories]
  );

  const selectedFactory = registry[providerKey] ?? registry[fallbackKey] ?? livekitFactory;
  const engineContext = selectedFactory({ state, setState, providerId: providerKey });

  return useMemo(() => engineContext, [engineContext]);
};

type VoiceComposerProps = VoiceProviderConfig & { children: React.ReactNode };

const VoiceComposer = ({ children, ...config }: VoiceComposerProps) => {
  const contextValue = useVoiceComposer(config);
  const ProviderWrapper = contextValue.providerRenderers.ProviderWrapper ?? React.Fragment;
  return (
    <VoiceContext.Provider value={contextValue}>
      <ProviderWrapper>{children}</ProviderWrapper>
    </VoiceContext.Provider>
  );
};

export const VoiceProvider = ({ children, ...config }: VoiceComposerProps) => (
  <VoiceStoreProvider>
    <VoiceComposer {...config}>{children}</VoiceComposer>
  </VoiceStoreProvider>
);

export type { VoiceProviderConfig, VoiceProviderFactory, VoiceProviderRegistry };
