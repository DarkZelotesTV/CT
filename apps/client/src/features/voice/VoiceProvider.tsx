import React, { useCallback, useMemo, useState } from 'react';
import { useVoiceEngine, type VoiceConnectRequest, type VoiceEngineDeps, type VoiceFallbackRequest } from './engine';
import { useMediasoupProvider } from './providers/mediasoup/MediasoupProvider';
import { useP2PProvider } from './providers/p2p/P2PProvider';
import { type VoiceProviderId } from './providers/types';
import { VoiceContext, type VoiceContextType } from './state/VoiceContext';
import { VoiceStoreProvider, useVoiceStore } from './state';

type VoiceProviderFactory = (deps: VoiceEngineDeps) => VoiceContextType;
type VoiceProviderRegistry = Partial<Record<VoiceProviderId, VoiceProviderFactory>>;

const livekitFactory: VoiceProviderFactory = (deps) => useVoiceEngine({ ...deps, providerId: 'livekit' });
const mediasoupFactory: VoiceProviderFactory = (deps) => useMediasoupProvider({ ...deps, providerId: 'mediasoup' });
const p2pFactory: VoiceProviderFactory = (deps) => useP2PProvider({ ...deps, providerId: 'p2p' });

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

type VoiceRuntimeConfig = VoiceProviderConfig & {
  initialConnectRequest?: VoiceConnectRequest | null;
  onFallbackRequest?: (request: VoiceFallbackRequest) => void;
};

const useVoiceComposer = (config: VoiceRuntimeConfig): VoiceContextType => {
  const { state, setState } = useVoiceStore();

  const providerKey = resolveProviderId(config);
  const fallbackKey = config.fallbackProviderId ?? (providerKey === 'p2p' ? 'mediasoup' : 'livekit');

  const registry = useMemo(
    () => ({
      ...defaultProviderFactories,
      ...(config.providerFactories ?? {}),
    }),
    [config.providerFactories]
  );

  const selectedFactory = registry[providerKey] ?? registry[fallbackKey] ?? livekitFactory;
  const engineContext = selectedFactory({
    state,
    setState,
    providerId: providerKey,
    fallbackProviderId: fallbackKey,
    initialConnectRequest: config.initialConnectRequest ?? null,
    requestFallback: config.onFallbackRequest,
  });

  return useMemo(() => engineContext, [engineContext]);
};

type VoiceComposerProps = VoiceRuntimeConfig & { children: React.ReactNode };

const VoiceComposer = ({ children, ...config }: VoiceComposerProps) => {
  const contextValue = useVoiceComposer(config);
  const ProviderWrapper = contextValue.providerRenderers.ProviderWrapper ?? React.Fragment;
  return (
    <VoiceContext.Provider value={contextValue}>
      <ProviderWrapper>{children}</ProviderWrapper>
    </VoiceContext.Provider>
  );
};

export const VoiceProvider = ({ children, ...config }: VoiceComposerProps) => {
  const resolvedProvider = resolveProviderId(config);
  const fallbackProviderId = config.fallbackProviderId ?? (resolvedProvider === 'p2p' ? 'mediasoup' : 'livekit');
  const [activeProviderId, setActiveProviderId] = useState<VoiceProviderId>(resolvedProvider);
  const [pendingConnect, setPendingConnect] = useState<VoiceConnectRequest | null>(null);

  const handleFallbackRequest = useCallback(
    (request: VoiceFallbackRequest) => {
      const target = request.targetProviderId ?? fallbackProviderId;
      if (!target || target === activeProviderId) return;
      setPendingConnect(
        request.channelId && request.channelName
          ? { channelId: request.channelId, channelName: request.channelName }
          : null
      );
      setActiveProviderId(target);
    },
    [activeProviderId, fallbackProviderId]
  );

  return (
    <VoiceStoreProvider>
      <VoiceComposer
        key={activeProviderId}
        {...config}
        providerId={activeProviderId}
        fallbackProviderId={fallbackProviderId}
        initialConnectRequest={pendingConnect}
        onFallbackRequest={handleFallbackRequest}
      >
        {children}
      </VoiceComposer>
    </VoiceStoreProvider>
  );
};

export type { VoiceProviderConfig, VoiceProviderFactory, VoiceProviderRegistry };
