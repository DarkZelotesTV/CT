import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

const emptyRenderers: VoiceProviderRenderers = {};

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
  }, []);

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

  const applyOutputVolume = useCallback(
    (volume: number, muted: boolean) => {
      audioElementsRef.current.forEach((el) => {
        el.volume = muted ? 0 : Math.max(0, Math.min(1, volume));
      });
    },
    []
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
      setState({ outputVolume: volume });
      applyOutputVolume(volume, state.muted);
      updateTalk({ outputVolume: volume });
    },
    [applyOutputVolume, setState, state.muted, updateTalk]
  );

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
        });

        if (consumer.kind === 'audio') {
          const audio = new Audio();
          audio.srcObject = new MediaStream([consumer.track]);
          audio.autoplay = true;
          audio.volume = state.muted ? 0 : state.outputVolume;
          audioElementsRef.current.set(consumer.id, audio);
          void audio.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Consumer konnte nicht erstellt werden', err);
      }
    },
    [emitWithAck, state.muted, state.outputVolume]
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

  const startMicrophone = useCallback(
    async (channelId: number) => {
      const sendTransport = sendTransportRef.current;
      if (!sendTransport) return;

      const constraints: MediaTrackConstraints | boolean = settings.devices.audioInputId
        ? { deviceId: settings.devices.audioInputId }
        : true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('Kein Audiotrack gefunden');

      const producer = await sendTransport.produce({
        track,
        appData: { kind: 'audio', channelId },
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
    [settings.devices.audioInputId, state.micMuted, state.usePushToTalk]
  );

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

        const device = new Device();
        await device.load({ routerRtpCapabilities: join.rtpCapabilities });
        deviceRef.current = device;

        updateParticipants(join.peers || [], localUserId);

        const send = await emitWithAck<TransportAck>('rtc:createTransport', { channelId, direction: 'send' });
        const recv = await emitWithAck<TransportAck>('rtc:createTransport', { channelId, direction: 'recv' });
        if (!send.transport || !recv.transport) throw new Error('Transport-Daten fehlen');

        const sendTransport = device.createSendTransport({
          id: send.transport.id,
          iceParameters: send.transport.iceParameters,
          iceCandidates: send.transport.iceCandidates,
          dtlsParameters: send.transport.dtlsParameters,
          sctpParameters: send.transport.sctpParameters,
        });

        const recvTransport = device.createRecvTransport({
          id: recv.transport.id,
          iceParameters: recv.transport.iceParameters,
          iceCandidates: recv.transport.iceCandidates,
          dtlsParameters: recv.transport.dtlsParameters,
          sctpParameters: recv.transport.sctpParameters,
        });

        sendTransportRef.current = sendTransport;
        recvTransportRef.current = recvTransport;

        connectTransport(sendTransport, send.transport.id, 'send', channelId);
        connectTransport(recvTransport, recv.transport.id, 'recv', channelId, () => {
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
    [connectTransport, consumePeerTracks, disconnect, emitWithAck, localUserId, setState, socket, startMicrophone, updateParticipants]
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
      const normalized = Math.max(0, Math.min(1, volume));
      updateTalk({
        participantVolumes: {
          ...(settings.talk.participantVolumes || {}),
          [participantId]: normalized,
        },
      });

      consumerPeerRef.current.forEach((peerId, consumerId) => {
        if (peerId === participantId) {
          const el = audioElementsRef.current.get(consumerId);
          if (el) el.volume = state.muted ? 0 : normalized;
        }
      });
    },
    [settings.talk.participantVolumes, state.muted, updateTalk]
  );

  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = (payload: { channelId?: number; peer?: PeerInfo }) => {
      if (!payload?.peer || payload.channelId !== state.activeChannelId) return;
      const peer = payload.peer;
      const peers = peerSnapshotRef.current || [];
      const filtered = peers.filter((p) => p.identity !== peer.identity);
      const nextPeers = [...filtered, peer];
      updateParticipants(nextPeers, localUserId);
      void consumePeerTracks(peer, payload.channelId ?? 0);
    };

    socket.on('rtc:newProducer', handleNewProducer);
    return () => {
      socket.off('rtc:newProducer', handleNewProducer);
    };
  }, [consumePeerTracks, localUserId, socket, state.activeChannelId, updateParticipants]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

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
    providerRenderers: emptyRenderers,
  };
};
