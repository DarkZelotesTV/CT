import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import type {
  Consumer,
  DtlsParameters,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Transport,
  TransportOptions,
} from 'mediasoup-client/types';
import { MediasoupDebugOverlay, type MediasoupDebugStats } from './MediasoupDebugOverlay';
import { useSettings } from '../../../../context/SettingsContext';
import { useSocket } from '../../../../context/SocketContext';
import { storage } from '../../../../shared/config/storage';
import { type VoiceEngineDeps } from '../../engine/useVoiceEngine';
import { type VoiceContextType } from '../../state/VoiceContext';
import { type VoiceParticipant, type VoiceProviderRenderers } from '../types';

type PeerInfo = { identity: string; tracks?: Array<{ sid: string; muted?: boolean; kind?: string }>; metadata?: any };

type JoinRoomAck = {
  success: boolean;
  roomName?: string;
  rtpCapabilities?: RtpCapabilities;
  peers?: PeerInfo[];
  error?: string;
};

type TransportAck = {
  success: boolean;
  transport?: TransportOptions & { id: string; direction: 'send' | 'recv' };
  error?: string;
};

type ConnectAck = { success: boolean; error?: string };
type ProduceAck = { success: boolean; producerId?: string; error?: string };
type ConsumeAck = {
  success: boolean;
  consumer?: { id: string; producerId: string; kind: MediaKind; rtpParameters: RtpParameters };
  error?: string;
};

const toParticipant = (peer: PeerInfo, localId: string | null): VoiceParticipant => {
  const audioTrack = peer.tracks?.find((track) => track.kind === 'audio');

  return {
    id: String(peer.identity ?? 'unknown'),
    name: String(peer.metadata?.username ?? peer.metadata?.displayName ?? peer.identity ?? 'User'),
    isLocal: localId === String(peer.identity ?? ''),
    isMicrophoneEnabled: audioTrack ? !audioTrack.muted : true,
    isCameraEnabled: Boolean(peer.tracks?.some((track) => track.kind === 'video')),
    isScreenShareEnabled: Boolean(peer.tracks?.some((track) => track.kind === 'screen')),
    metadata: peer.metadata ? JSON.stringify(peer.metadata) : null,
  };
};

type MediasoupAudioRendererProps = {
  getAudioElements: () => Map<string, HTMLAudioElement>;
  renderRevision: number;
  autoplayBlocked: boolean;
  requestAutoplay: () => Promise<void>;
};

const MediasoupAudioRenderer: React.FC<MediasoupAudioRendererProps> = ({
  getAudioElements,
  renderRevision,
  autoplayBlocked,
  requestAutoplay,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = getAudioElements();

    elements.forEach((audio) => {
      audio.style.display = 'none';
      if (audio.parentElement !== container) {
        container.appendChild(audio);
      }
    });

    Array.from(container.children).forEach((child) => {
      const el = child as HTMLAudioElement;
      const consumerId = el.dataset?.consumerId;
      if (consumerId && !elements.has(consumerId)) {
        el.remove();
      }
    });
  }, [getAudioElements, renderRevision]);

  const hasAudio = getAudioElements().size > 0;

  if (!autoplayBlocked && !hasAudio) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      <div ref={containerRef} className="sr-only" aria-hidden="true" />
      {autoplayBlocked && (
        <div className="pointer-events-auto fixed bottom-4 right-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 text-[var(--color-text)]">
            <span className="text-sm font-medium">Audio-Wiedergabe erforderlich</span>
            <button
              type="button"
              onClick={() => {
                void requestAutoplay();
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold hover:brightness-110 transition"
            >
              Jetzt abspielen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const useMediasoupProvider = ({ state, setState }: VoiceEngineDeps): VoiceContextType => {
  const { settings, updateTalk } = useSettings();
  const { socket, optimisticLeave } = useSocket();

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const consumerPeerRef = useRef<Map<string, string>>(new Map());
  const peerSnapshotRef = useRef<JoinRoomAck['peers']>([]);
  const connectingRef = useRef(false);
  const lastJoinedChannelRef = useRef<{ id: number; name: string | null } | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [audioRenderRevision, setAudioRenderRevision] = useState(0);
  const [debugStats, setDebugStats] = useState<MediasoupDebugStats>({ inbound: null, outbound: null, updatedAt: null, consumerCount: 0 });
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const localUserId = useMemo(() => {
    const user = storage.get('cloverUser') as { id?: number | string } | null;
    return user?.id ? String(user.id) : null;
  }, []);

  const emitWithAck = useCallback(
    async <T extends { success: boolean; error?: string }>(event: string, payload?: any, timeoutMs = 5000): Promise<T> => {
      if (!socket) throw new Error('Socket nicht verbunden');

      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout bei ${event}`)), timeoutMs);

        socket.emit(event, payload, (response: T) => {
          clearTimeout(timer);
          if (response?.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || `Fehler bei ${event}`));
          }
        });
      });
    },
    [socket]
  );

  const cleanupConsumers = useCallback(() => {
    consumersRef.current.forEach((consumer) => {
      try {
        consumer.close();
      } catch {
        /* noop */
      }
    });
    consumersRef.current.clear();
    consumerPeerRef.current.clear();

    audioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        (el.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
    });
    audioElementsRef.current.clear();
    setAudioRenderRevision((v) => v + 1);
    setAutoplayBlocked(false);
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setDebugStats({ inbound: null, outbound: null, updatedAt: null, consumerCount: 0 });
  }, []);

  const detachConsumer = useCallback(
    (consumerId: string) => {
      const consumer = consumersRef.current.get(consumerId);
      if (consumer) {
        try {
          consumer.close();
        } catch {
          /* noop */
        }
        consumersRef.current.delete(consumerId);
      }

      consumerPeerRef.current.delete(consumerId);

      const audio = audioElementsRef.current.get(consumerId);
      if (audio) {
        try {
          audio.pause();
          (audio.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
        } catch {
          /* noop */
        }
        audioElementsRef.current.delete(consumerId);
      }

      setAudioRenderRevision((v) => v + 1);
      if (audioElementsRef.current.size === 0) setAutoplayBlocked(false);
    },
    [setAudioRenderRevision]
  );

  const cleanupPeerConsumers = useCallback(
    (peerId: string, activeProducerIds: string[]) => {
      consumersRef.current.forEach((consumer, consumerId) => {
        const mappedPeer = consumerPeerRef.current.get(consumerId);
        const producerId = (consumer as any)?.producerId as string | undefined;
        if (mappedPeer === peerId && (!producerId || !activeProducerIds.includes(producerId))) {
          detachConsumer(consumerId);
        }
      });
    },
    [detachConsumer]
  );

  const cleanupTransports = useCallback(() => {
    const track = producerRef.current?.track as MediaStreamTrack | undefined;
    try {
      track?.stop();
    } catch {
      /* noop */
    }
    try {
      producerRef.current?.close();
    } catch {
      /* noop */
    }
    producerRef.current = null;

    try {
      sendTransportRef.current?.close();
    } catch {
      /* noop */
    }
    try {
      recvTransportRef.current?.close();
    } catch {
      /* noop */
    }
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;
  }, []);

  const calculateVolume = useCallback(
    (peerId: string | undefined, globalVolume: number, muted: boolean) => {
      if (muted) return 0;
      const participantVolumes = settings.talk.participantVolumes || {};
      const baseVolume = peerId ? participantVolumes[peerId] ?? 1 : 1;
      const normalizedBase = Math.max(0, Math.min(2, baseVolume));
      const normalizedGlobal = Math.max(0, Math.min(2, globalVolume));
      return Math.max(0, Math.min(1, normalizedBase * normalizedGlobal));
    },
    [settings.talk.participantVolumes]
  );

  const applyOutputVolume = useCallback(
    (volume: number, muted: boolean) => {
      audioElementsRef.current.forEach((el, consumerId) => {
        const peerId = consumerPeerRef.current.get(consumerId);
        el.volume = calculateVolume(peerId, volume, muted);
      });
    },
    [calculateVolume]
  );

  const setMuted = useCallback(
    async (muted: boolean) => {
      setState({ muted });
      applyOutputVolume(state.outputVolume, muted);
      updateTalk({ muted });
    },
    [applyOutputVolume, setState, state.outputVolume, updateTalk]
  );

  const setOutputVolume = useCallback(
    async (volume: number) => {
      const normalized = Math.max(0, Math.min(2, volume));
      setState({ outputVolume: normalized });
      applyOutputVolume(normalized, state.muted);
      updateTalk({ outputVolume: normalized });
    },
    [applyOutputVolume, setState, state.muted, updateTalk]
  );

  useEffect(() => {
    applyOutputVolume(state.outputVolume, state.muted);
  }, [applyOutputVolume, state.muted, state.outputVolume]);

  useEffect(() => {
    if (state.activeChannelId) {
      lastJoinedChannelRef.current = { id: state.activeChannelId, name: state.activeChannelName };
    } else {
      lastJoinedChannelRef.current = null;
    }
  }, [state.activeChannelId, state.activeChannelName]);

  const requestAutoplay = useCallback(async () => {
    const elements = Array.from(audioElementsRef.current.values());
    if (!elements.length) {
      setAutoplayBlocked(false);
      return;
    }

    let blocked = false;
    await Promise.all(
      elements.map(async (el) => {
        try {
          await el.play();
        } catch {
          blocked = true;
        }
      })
    );

    setAutoplayBlocked(blocked);
  }, []);

  const getAudioElements = useCallback(() => audioElementsRef.current, []);

  useEffect(() => {
    const sinkId = settings.devices.audioOutputId;
    if (!sinkId) return;
    audioElementsRef.current.forEach((audio) => {
      const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (typeof audioWithSink.setSinkId === 'function') {
        audioWithSink.setSinkId(sinkId).catch((err: any) => console.warn('Ausgabegerät konnte nicht gesetzt werden', err));
      }
    });
  }, [settings.devices.audioOutputId]);

  const updateParticipants = useCallback(
    (peers: PeerInfo[] | undefined, localId: string | null) => {
      peerSnapshotRef.current = peers || [];
      const participants: VoiceParticipant[] = (peers || []).map((peer) => toParticipant(peer, localId));
      setState({
        participants,
        localParticipantId: localId,
        providerId: 'mediasoup',
      });
    },
    [setState]
  );

  const syncPeerSnapshot = useCallback(
    (peer: PeerInfo | undefined, removedProducerId?: string) => {
      if (!peer?.identity) return;

      const peers = peerSnapshotRef.current || [];
      const filtered = peers.filter((p) => p.identity !== peer.identity);
      const sanitizedTracks = (peer.tracks || []).filter((track) => !removedProducerId || track.sid !== removedProducerId);
      const nextPeers = sanitizedTracks.length ? [...filtered, { ...peer, tracks: sanitizedTracks }] : filtered;

      peerSnapshotRef.current = nextPeers;
      updateParticipants(nextPeers, localUserId);
      cleanupPeerConsumers(String(peer.identity), sanitizedTracks.map((track) => track.sid).filter(Boolean));
    },
    [cleanupPeerConsumers, localUserId, updateParticipants]
  );

  const attachConsumer = useCallback(
    async (peerId: string, producerId: string, channelId: number) => {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      try {
        const response = await emitWithAck<ConsumeAck>('rtc:consume', {
          channelId,
          transportId: recvTransport.id,
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        const { consumer: consumerInfo } = response;
        if (!consumerInfo) throw new Error('Consumer-Daten fehlen');

        const consumer = await recvTransport.consume({
          id: consumerInfo.id,
          producerId: consumerInfo.producerId,
          kind: consumerInfo.kind,
          rtpParameters: consumerInfo.rtpParameters,
        });

        consumersRef.current.set(consumer.id, consumer);
        consumerPeerRef.current.set(consumer.id, peerId);

        consumer.on('transportclose', () => {
          consumersRef.current.delete(consumer.id);
          consumerPeerRef.current.delete(consumer.id);
          const audio = audioElementsRef.current.get(consumer.id);
          if (audio) {
            try {
              audio.pause();
              (audio.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
            } catch {
              /* noop */
            }
            audioElementsRef.current.delete(consumer.id);
          }
          setAudioRenderRevision((v) => v + 1);
          if (audioElementsRef.current.size === 0) setAutoplayBlocked(false);
        });

        if (consumer.kind === 'audio') {
          const audio = new Audio();
          audio.srcObject = new MediaStream([consumer.track]);
          audio.autoplay = true;
          audio.playsInline = true;
          audio.dataset.consumerId = consumer.id;
          audio.volume = calculateVolume(peerId, state.outputVolume, state.muted);
          const sinkId = settings.devices.audioOutputId;
          const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
          if (sinkId && typeof audioWithSink.setSinkId === 'function') {
            audioWithSink.setSinkId(sinkId).catch((err: any) => console.warn('Ausgabegerät konnte nicht gesetzt werden', err));
          }
          audioElementsRef.current.set(consumer.id, audio);
          setAudioRenderRevision((v) => v + 1);
          void audio
            .play()
            .then(() => setAutoplayBlocked(false))
            .catch((err) => {
              console.warn('Audio-Wiedergabe blockiert', err);
              setAutoplayBlocked(true);
            });
        }
      } catch (err) {
        console.warn('Consumer konnte nicht erstellt werden', err);
      }
    },
    [calculateVolume, emitWithAck, settings.devices.audioOutputId, state.muted, state.outputVolume]
  );

  const consumePeerTracks = useCallback(
    async (peer: PeerInfo, channelId: number) => {
      if (!peer?.tracks?.length) return;
      for (const track of peer.tracks) {
        if (track.kind === 'audio' && track.sid) {
          await attachConsumer(peer.identity, track.sid, channelId);
        }
      }
    },
    [attachConsumer]
  );

  const loadDevice = useCallback(async (rtpCapabilities: RtpCapabilities) => {
    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;
    return device;
  }, []);

  const connectTransport = useCallback(
    (
      transport: Transport,
      transportId: string,
      direction: 'send' | 'recv',
      channelId: number,
      onConnected?: () => void
    ) => {
      transport.on(
        'connect',
        ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: () => void, errback: (error: Error) => void) => {
        emitWithAck<ConnectAck>('rtc:connectTransport', { transportId, dtlsParameters })
          .then(() => callback())
          .catch((err) => errback(err));
        }
      );

      if (direction === 'send') {
        transport.on(
          'produce',
          (
            { kind, rtpParameters, appData }: { kind: MediaKind; rtpParameters: RtpParameters; appData: Record<string, any> | undefined },
            callback: (params: { id: string }) => void,
            errback: (error: Error) => void
          ) => {
          emitWithAck<ProduceAck>('rtc:produce', {
            channelId,
            transportId,
            rtpParameters,
            appData: { ...(appData || {}), kind },
          })
            .then((res) => {
              if (res.producerId) callback({ id: res.producerId });
              else errback(new Error('Producer-ID fehlt'));
            })
            .catch((err) => errback(err));
          }
        );
      }

      transport.on('connectionstatechange', (connectionState: Transport['connectionState']) => {
        if (connectionState === 'connected') onConnected?.();
      });
    },
    [emitWithAck]
  );

  const createSendTransport = useCallback(
    async (device: Device, channelId: number) => {
      const send = await emitWithAck<TransportAck>('rtc:createTransport', { channelId, direction: 'send' });
      if (!send.transport) throw new Error('Transport-Daten fehlen');

      const sendTransport = device.createSendTransport({
        id: send.transport.id,
        iceParameters: send.transport.iceParameters,
        iceCandidates: send.transport.iceCandidates,
        dtlsParameters: send.transport.dtlsParameters,
        sctpParameters: send.transport.sctpParameters,
      });

      sendTransportRef.current = sendTransport;
      connectTransport(sendTransport, send.transport.id, 'send', channelId);

      return { sendTransport, sendInfo: send.transport };
    },
    [connectTransport, emitWithAck]
  );

  const createRecvTransport = useCallback(
    async (device: Device, channelId: number) => {
      const recv = await emitWithAck<TransportAck>('rtc:createTransport', { channelId, direction: 'recv' });
      if (!recv.transport) throw new Error('Transport-Daten fehlen');

      const recvTransport = device.createRecvTransport({
        id: recv.transport.id,
        iceParameters: recv.transport.iceParameters,
        iceCandidates: recv.transport.iceCandidates,
        dtlsParameters: recv.transport.dtlsParameters,
        sctpParameters: recv.transport.sctpParameters,
      });

      recvTransportRef.current = recvTransport;

      return { recvTransport, recvInfo: recv.transport };
    },
    [emitWithAck]
  );

  const startMicrophone = useCallback(
    async (channelId: number) => {
      const device = deviceRef.current;
      if (!device) throw new Error('Kein RTC-Gerät initialisiert');

      let sendTransport = sendTransportRef.current;
      if (!sendTransport) {
        const created = await createSendTransport(device, channelId);
        sendTransport = created.sendTransport;
      }

      if (!sendTransport) return;

      const constraints: MediaTrackConstraints | boolean = settings.devices.audioInputId
        ? { deviceId: settings.devices.audioInputId }
        : true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('Kein Audiotrack gefunden');

      const producer = await sendTransport.produce({
        track,
        appData: { kind: 'audio', channelId, audioPreset: settings.talk.audioPreset ?? 'voice' },
      });

      producerRef.current = producer;

      if (state.micMuted || state.usePushToTalk) {
        try {
          producer.pause();
        } catch {
          /* noop */
        }
      }
    },
    [createSendTransport, settings.devices.audioInputId, settings.talk.audioPreset, state.micMuted, state.usePushToTalk]
  );

  const disconnect = useCallback(async () => {
    const activeChannelId = state.activeChannelId;
    if (activeChannelId && optimisticLeave) {
      const user = storage.get('cloverUser') as { id?: number | string } | null;
      if (user?.id) optimisticLeave(activeChannelId, user.id);
    }

    cleanupConsumers();
    cleanupTransports();
    setState({
      connectionState: 'disconnected',
      connectionHandle: null,
      activeChannelId: null,
      activeChannelName: null,
      participants: [],
      activeSpeakerIds: [],
      error: null,
      providerId: null,
      localParticipantId: null,
    });
    connectingRef.current = false;
  }, [cleanupConsumers, cleanupTransports, optimisticLeave, setState, state.activeChannelId]);

  const connectToChannel = useCallback(
    async (channelId: number, channelName: string) => {
      if (!socket) throw new Error('Socket nicht verbunden');
      if (connectingRef.current) return;

      connectingRef.current = true;
      setState({
        connectionState: 'connecting',
        activeChannelId: channelId,
        activeChannelName: channelName,
        providerId: 'mediasoup',
        error: null,
      });

      try {
        socket.emit('join_channel', channelId);

        const join = await emitWithAck<JoinRoomAck>('rtc:joinRoom', { channelId });
        if (!join.roomName || !join.rtpCapabilities) throw new Error(join.error || 'RTC-Raum konnte nicht betreten werden');

        const device = await loadDevice(join.rtpCapabilities);

        updateParticipants(join.peers || [], localUserId);

        const { recvTransport, recvInfo } = await createRecvTransport(device, channelId);

        connectTransport(recvTransport, recvInfo.id, 'recv', channelId, () => {
          setState({ connectionState: 'connected', error: null });
        });

        await startMicrophone(channelId);

        for (const peer of join.peers || []) {
          if (String(peer.identity) !== localUserId) {
            await consumePeerTracks(peer, channelId);
          }
        }

        setState({
          connectionState: 'connected',
          connectionHandle: { provider: 'mediasoup', sessionId: join.roomName },
          activeChannelId: channelId,
          activeChannelName: channelName,
          providerId: 'mediasoup',
        });
      } catch (err: any) {
        console.warn('Mediasoup Verbindung fehlgeschlagen', err);
        setState({ error: err?.message || 'Verbindung fehlgeschlagen', connectionState: 'disconnected' });
        await disconnect();
      } finally {
        connectingRef.current = false;
      }
    },
    [connectTransport, consumePeerTracks, createRecvTransport, disconnect, emitWithAck, loadDevice, localUserId, setState, socket, startMicrophone, updateParticipants]
  );

  const setMicMuted = useCallback(
    async (muted: boolean) => {
      setState({ micMuted: muted });
      updateTalk({ micMuted: muted });
      const producer = producerRef.current;
      if (!producer) return;
      try {
        if (muted) producer.pause();
        else producer.resume();
      } catch {
        /* noop */
      }
    },
    [setState, updateTalk]
  );

  const setPushToTalk = useCallback(
    async (enabled: boolean) => {
      setState({ usePushToTalk: enabled });
      updateTalk({ pushToTalkEnabled: enabled });
    },
    [setState, updateTalk]
  );

  const startTalking = useCallback(async () => {
    if (!state.usePushToTalk) return;
    await setMicMuted(false);
    setState({ isTalking: true });
  }, [setMicMuted, setState, state.usePushToTalk]);

  const stopTalking = useCallback(async () => {
    if (!state.usePushToTalk) return;
    await setMicMuted(true);
    setState({ isTalking: false });
  }, [setMicMuted, setState, state.usePushToTalk]);

  const setRnnoiseEnabled = useCallback(
    async (enabled: boolean) => {
      setState({ rnnoiseEnabled: enabled, rnnoiseAvailable: false, rnnoiseError: 'RNNoise wird in Mediasoup nicht unterstützt.' });
    },
    [setState]
  );

  const unsupported = useCallback(
    async (message: string) => {
      setState({ cameraError: message, screenShareError: message });
    },
    [setState]
  );

  const startCamera = useCallback(async () => unsupported('Kamera wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);
  const stopCamera = useCallback(async () => unsupported('Kamera wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);
  const toggleCamera = useCallback(async () => unsupported('Kamera wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);
  const startScreenShare = useCallback(async () => unsupported('Screenshare wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);
  const stopScreenShare = useCallback(async () => unsupported('Screenshare wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);
  const toggleScreenShare = useCallback(async () => unsupported('Screenshare wird vom Mediasoup-Client noch nicht unterstützt.'), [unsupported]);

  const setShareSystemAudio = useCallback(
    (next: React.SetStateAction<boolean>) => {
      setState((prev) => ({
        shareSystemAudio: typeof next === 'function' ? next(prev.shareSystemAudio) : next,
      }));
    },
    [setState]
  );

  const setParticipantVolume = useCallback(
    (participantId: string, volume: number) => {
      const normalized = Math.max(0, Math.min(2, volume));
      updateTalk({
        participantVolumes: {
          ...(settings.talk.participantVolumes || {}),
          [participantId]: normalized,
        },
      });

      consumerPeerRef.current.forEach((peerId, consumerId) => {
        if (peerId === participantId) {
          const el = audioElementsRef.current.get(consumerId);
          if (el) el.volume = calculateVolume(participantId, state.outputVolume, state.muted);
        }
      });
    },
    [calculateVolume, settings.talk.participantVolumes, state.muted, state.outputVolume, updateTalk]
  );

  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = (payload: { channelId?: number; peer?: PeerInfo }) => {
      if (!payload?.peer || payload.channelId !== state.activeChannelId) return;
      syncPeerSnapshot(payload.peer);
      void consumePeerTracks(payload.peer, payload.channelId ?? 0);
    };

    const handleProducerClosed = (payload: { channelId?: number; peer?: PeerInfo; producerId?: string }) => {
      if (!payload?.peer || payload.channelId !== state.activeChannelId) return;
      syncPeerSnapshot(payload.peer, payload.producerId);
    };

    socket.on('rtc:newProducer', handleNewProducer);
    socket.on('producerClosed', handleProducerClosed);
    return () => {
      socket.off('rtc:newProducer', handleNewProducer);
      socket.off('producerClosed', handleProducerClosed);
    };
  }, [consumePeerTracks, socket, state.activeChannelId, syncPeerSnapshot]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    const collectStats = async () => {
      const producer = producerRef.current;
      const consumers = Array.from(consumersRef.current.values());

      const outboundStats = await (async () => {
        if (!producer?.getStats) return null;
        try {
          const reports = await producer.getStats();
          const outbound = Array.from(reports.values()).find((r: any) => r.type === 'outbound-rtp');
          if (!outbound) return null;
          const rttMs = typeof outbound.roundTripTime === 'number' ? outbound.roundTripTime * 1000 : outbound.rtt ?? null;
          const jitterMs = typeof outbound.jitter === 'number' ? outbound.jitter * 1000 : null;
          const bitrateKbps = typeof outbound.bitrate === 'number' ? outbound.bitrate / 1000 : outbound.bitrateMean ?? null;
          const loss = typeof outbound.packetsLost === 'number' && typeof outbound.packetsSent === 'number'
            ? (outbound.packetsLost / Math.max(1, outbound.packetsSent + outbound.packetsLost)) * 100
            : null;

          return {
            bitrateKbps,
            packetLossPercent: loss,
            jitterMs,
            rttMs,
          };
        } catch (err) {
          console.warn('Producer stats failed', err);
          return null;
        }
      })();

      const inboundStats = await (async () => {
        if (!consumers.length) return null;

        const reports = await Promise.all(
          consumers.map(async (consumer) => {
            if (!consumer.getStats) return null;
            try {
              const stats = await consumer.getStats();
              const inbound = Array.from(stats.values()).find((r: any) => r.type === 'inbound-rtp');
              return inbound ?? null;
            } catch (err) {
              console.warn('Consumer stats failed', err);
              return null;
            }
          })
        );

        const inboundReports = reports.filter(Boolean) as any[];
        if (!inboundReports.length) return null;

        const packetLoss = inboundReports.reduce((sum, r) => sum + (r.packetsLost ?? 0), 0);
        const packets = inboundReports.reduce((sum, r) => sum + (r.packetsReceived ?? 0) + (r.packetsLost ?? 0), 0);
        const jitterMs = inboundReports.reduce((sum, r) => sum + (r.jitter ?? 0), 0) / inboundReports.length;
        const bitrateKbps = inboundReports.reduce((sum, r) => sum + (r.bitrate ?? 0), 0) / inboundReports.length / 1000;
        const rttMs = inboundReports.reduce((sum, r) => sum + (r.roundTripTime ?? 0), 0) / inboundReports.length;

        return {
          bitrateKbps: Number.isFinite(bitrateKbps) ? bitrateKbps : null,
          packetLossPercent: packets > 0 ? (packetLoss / packets) * 100 : null,
          jitterMs: Number.isFinite(jitterMs) ? jitterMs * 1000 : null,
          rttMs: Number.isFinite(rttMs) ? rttMs * 1000 : null,
        };
      })();

      setDebugStats({
        outbound: outboundStats,
        inbound: inboundStats,
        updatedAt: Date.now(),
        consumerCount: consumers.length,
      });
    };

    if (state.connectionState === 'connected') {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = setInterval(collectStats, 2000);
      void collectStats();
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [state.connectionState]);

  const providerRenderers = useMemo<VoiceProviderRenderers>(
    () => ({
      AudioRenderer: () => (
        <MediasoupAudioRenderer
          getAudioElements={getAudioElements}
          renderRevision={audioRenderRevision}
          autoplayBlocked={autoplayBlocked}
          requestAutoplay={requestAutoplay}
        />
      ),
      DebugOverlay: () => <MediasoupDebugOverlay stats={debugStats} connectionState={state.connectionState} />,
    }),
    [audioRenderRevision, autoplayBlocked, debugStats, getAudioElements, requestAutoplay, state.connectionState]
  );

  const rejoinActiveChannel = useCallback(async () => {
    if (!socket) return;
    const lastChannel = lastJoinedChannelRef.current;
    if (!lastChannel || connectingRef.current) return;

    setState({ connectionState: 'reconnecting', error: null, providerId: 'mediasoup' });
    cleanupConsumers();
    cleanupTransports();
    peerSnapshotRef.current = [];

    try {
      await connectToChannel(lastChannel.id, lastChannel.name || `Talk ${lastChannel.id}`);
    } catch (err: any) {
      setState({ error: err?.message || 'Verbindung fehlgeschlagen', connectionState: 'disconnected' });
    }
  }, [cleanupConsumers, cleanupTransports, connectToChannel, setState, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.io.on('reconnect', rejoinActiveChannel);
    return () => {
      socket.io.off('reconnect', rejoinActiveChannel);
    };
  }, [rejoinActiveChannel, socket]);

  return {
    providerId: 'mediasoup',
    connectionHandle: state.connectionHandle,
    activeChannelId: state.activeChannelId,
    activeChannelName: state.activeChannelName,
    connectionState: state.connectionState,
    error: state.error,
    cameraError: state.cameraError,
    screenShareError: state.screenShareError,
    participants: state.participants,
    activeSpeakerIds: state.activeSpeakerIds,
    connectToChannel,
    disconnect,
    getNativeHandle: () => ({
      device: deviceRef.current,
      sendTransport: sendTransportRef.current,
      recvTransport: recvTransportRef.current,
    }),
    token: null,
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
    rnnoiseError: state.rnnoiseError,
    setMuted,
    setMicMuted,
    setPushToTalk,
    setRnnoiseEnabled,
    startTalking,
    stopTalking,
    startCamera,
    stopCamera,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    shareSystemAudio: state.shareSystemAudio,
    setShareSystemAudio,
    selectedAudioInputId: settings.devices.audioInputId,
    selectedAudioOutputId: settings.devices.audioOutputId,
    selectedVideoInputId: settings.devices.videoInputId,
    localParticipantId: state.localParticipantId,
    outputVolume: state.outputVolume,
    setOutputVolume,
    setParticipantVolume,
    screenShareAudioError: state.screenShareAudioError,
    localAudioLevel: state.localAudioLevel,
    providerRenderers,
  };
};
