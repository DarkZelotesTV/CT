import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  socketEvents,
  type P2pCandidateEnvelope,
  type P2pJoinAck,
  type P2pOfferAnswerEnvelope,
  type P2pPeerSummary,
  type P2pSignalEnvelope,
} from '@clover/shared';
import { useSettings } from '../../../../context/SettingsContext';
import { useSocket } from '../../../../context/SocketContext';
import { storage } from '../../../../shared/config/storage';
import { getLiveKitConfig } from '../../../../utils/apiConfig';
import { type VoiceEngineDeps } from '../../engine/useVoiceEngine';
import { type VoiceContextType } from '../../state/VoiceContext';
import { type VoiceParticipant, type VoiceProviderRenderers } from '../types';

type PeerId = string;

const HiddenAudioRenderer: React.FC<{
  getAudioElements: () => Map<PeerId, HTMLAudioElement>;
  renderRevision: number;
  autoplayBlocked: boolean;
  requestAutoplay: () => Promise<void>;
}> = ({ getAudioElements, renderRevision, autoplayBlocked, requestAutoplay }) => {
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
      const peerId = el.dataset?.peerId;
      if (peerId && !elements.has(peerId)) {
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

type PeerProfile = P2pPeerSummary & { id: PeerId };

const toParticipant = (peer: PeerProfile, localId: PeerId | null): VoiceParticipant => ({
  id: peer.id,
  name: peer.username ?? peer.id,
  isLocal: peer.id === localId,
  isMicrophoneEnabled: true,
  isCameraEnabled: false,
  isScreenShareEnabled: false,
  metadata: null,
});

export const useP2PProvider = ({ state, setState }: VoiceEngineDeps): VoiceContextType => {
  const { socket, optimisticLeave } = useSocket();
  const { settings, updateTalk } = useSettings();

  const peerInfoRef = useRef<Map<PeerId, PeerProfile>>(new Map());
  const peerConnectionsRef = useRef<Map<PeerId, RTCPeerConnection>>(new Map());
  const peerStreamsRef = useRef<Map<PeerId, MediaStream>>(new Map());
  const audioElementsRef = useRef<Map<PeerId, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<PeerId, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const configRef = useRef<RTCConfiguration | null>(null);
  const activeChannelRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [audioRenderRevision, setAudioRenderRevision] = useState(0);

  const localUser = useMemo(() => storage.get('cloverUser') as { id?: number | string; username?: string } | null, []);
  const localId = useMemo(() => (localUser?.id ? String(localUser.id) : null), [localUser?.id]);

  const emitWithAck = useCallback(
    async <T extends { success: boolean; error?: string }>(event: keyof typeof socketEvents, payload?: any, timeoutMs = 5000) => {
      if (!socket) throw new Error('Socket nicht verbunden');
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout bei ${String(event)}`)), timeoutMs);
        // @ts-expect-error socket typing via shared events
        socket.emit(socketEvents[event], payload, (response: T) => {
          clearTimeout(timer);
          if (response?.success) resolve(response);
          else reject(new Error(response?.error || `Fehler bei ${String(event)}`));
        });
      });
    },
    [socket]
  );

  const cleanupPeer = useCallback(
    (peerId: PeerId) => {
      const connection = peerConnectionsRef.current.get(peerId);
      if (connection) {
        try {
          connection.close();
        } catch {
          /* noop */
        }
        peerConnectionsRef.current.delete(peerId);
      }

      const stream = peerStreamsRef.current.get(peerId);
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* noop */
          }
        });
        peerStreamsRef.current.delete(peerId);
      }

      const audio = audioElementsRef.current.get(peerId);
      if (audio) {
        try {
          audio.pause();
          (audio.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
        } catch {
          /* noop */
        }
        audioElementsRef.current.delete(peerId);
      }

      pendingCandidatesRef.current.delete(peerId);
      peerInfoRef.current.delete(peerId);
      setAudioRenderRevision((rev) => rev + 1);
    },
    []
  );

  const cleanupAll = useCallback(() => {
    Array.from(peerConnectionsRef.current.keys()).forEach((peerId) => cleanupPeer(peerId));
    peerConnectionsRef.current.clear();
    peerStreamsRef.current.clear();
    peerInfoRef.current.clear();
    pendingCandidatesRef.current.clear();
    audioElementsRef.current.forEach((audio) => {
      try {
        audio.pause();
        (audio.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
    });
    audioElementsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setAudioRenderRevision((rev) => rev + 1);
    setAutoplayBlocked(false);
  }, [cleanupPeer]);

  const updateParticipants = useCallback(
    (extraPeers?: PeerProfile[]) => {
      const peers = extraPeers ?? Array.from(peerInfoRef.current.values());
      const participants: VoiceParticipant[] = peers.map((peer) => toParticipant(peer, localId));

      if (localId) {
        participants.unshift({
          id: localId,
          name: localUser?.username ?? localId,
          isLocal: true,
          isMicrophoneEnabled: !(state.micMuted || state.muted),
          isCameraEnabled: false,
          isScreenShareEnabled: false,
          metadata: null,
        });
      }

      setState({
        participants,
        localParticipantId: localId,
        providerId: 'p2p',
      });
    },
    [localId, localUser?.username, setState, state.micMuted, state.muted]
  );

  const calculateVolume = useCallback(
    (peerId: PeerId | null, globalVolume: number, muted: boolean) => {
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
      audioElementsRef.current.forEach((el, peerId) => {
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

  useEffect(() => {
    applyOutputVolume(state.outputVolume, state.muted);
  }, [applyOutputVolume, state.muted, state.outputVolume]);

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

  const attachRemoteStream = useCallback(
    (peerId: PeerId, stream: MediaStream) => {
      peerStreamsRef.current.set(peerId, stream);
      const existing = audioElementsRef.current.get(peerId);
      const audio = existing ?? new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.peerId = peerId;
      audio.volume = calculateVolume(peerId, state.outputVolume, state.muted);

      const sinkId = settings.devices.audioOutputId;
      const audioWithSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (sinkId && typeof audioWithSink.setSinkId === 'function') {
        audioWithSink.setSinkId(sinkId).catch((err: any) => console.warn('Ausgabegerät konnte nicht gesetzt werden', err));
      }

      audioElementsRef.current.set(peerId, audio);
      setAudioRenderRevision((rev) => rev + 1);

      void audio
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => {
          console.warn('Audio-Wiedergabe blockiert', err);
          setAutoplayBlocked(true);
        });
    },
    [calculateVolume, settings.devices.audioOutputId, state.muted, state.outputVolume]
  );

  const applyPendingCandidates = useCallback(async (peerId: PeerId, connection: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(peerId);
    if (!pending?.length) return;
    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(candidate);
      } catch (err) {
        console.warn('Candidate konnte nicht angewendet werden', err);
      }
    }
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  const sendOfferOrAnswer = useCallback(
    async (peerId: PeerId, description: RTCSessionDescriptionInit, kind: 'offer' | 'answer') => {
      if (!socket || !activeChannelRef.current) return;
      const targetUserId = Number(peerId);
      const event = kind === 'offer' ? 'p2pOffer' : 'p2pAnswer';
      try {
        await emitWithAck<{ success: boolean; error?: string }>(event, {
          channelId: activeChannelRef.current,
          targetUserId,
          description,
        });
      } catch (err) {
        console.warn(`${kind} konnte nicht gesendet werden`, err);
      }
    },
    [emitWithAck, socket]
  );

  const sendCandidate = useCallback(
    async (peerId: PeerId, candidate: RTCIceCandidateInit) => {
      if (!socket || !activeChannelRef.current) return;
      const targetUserId = Number(peerId);
      try {
        await emitWithAck<{ success: boolean; error?: string }>('p2pCandidate', {
          channelId: activeChannelRef.current,
          targetUserId,
          candidate,
        });
      } catch (err) {
        console.warn('Candidate konnte nicht gesendet werden', err);
      }
    },
    [emitWithAck, socket]
  );

  const handleConnectionState = useCallback(
    (peerId: PeerId, state: RTCPeerConnectionState) => {
      if (['failed', 'closed'].includes(state)) {
        cleanupPeer(peerId);
        updateParticipants();
      }
    },
    [cleanupPeer, updateParticipants]
  );

  const createPeerConnection = useCallback(
    (peerId: PeerId, initiator = false) => {
      if (peerConnectionsRef.current.has(peerId)) return peerConnectionsRef.current.get(peerId)!;

      const rtcConfig = configRef.current || getLiveKitConfig().connectOptions?.rtcConfig || {};
      const connection = new RTCPeerConnection(rtcConfig);

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          connection.addTrack(track, localStream);
        });
      }

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          void sendCandidate(peerId, event.candidate.toJSON());
        }
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          attachRemoteStream(peerId, stream);
          updateParticipants();
        }
      };

      connection.onconnectionstatechange = () => {
        handleConnectionState(peerId, connection.connectionState);
      };

      peerConnectionsRef.current.set(peerId, connection);

      if (initiator) {
        void (async () => {
          try {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            if (connection.localDescription) {
              await sendOfferOrAnswer(peerId, connection.localDescription, 'offer');
            }
          } catch (err) {
            console.warn('Offer konnte nicht erstellt werden', err);
          }
        })();
      }

      return connection;
    },
    [attachRemoteStream, handleConnectionState, sendOfferOrAnswer, sendCandidate, updateParticipants]
  );

  const handleOffer = useCallback(
    async (payload: P2pOfferAnswerEnvelope) => {
      if (!payload.fromUserId || !payload.description) return;
      const peerId = String(payload.fromUserId);
      const connection = createPeerConnection(peerId, false);
      try {
        const description = payload.description as RTCSessionDescriptionInit;
        await connection.setRemoteDescription(description);
        await applyPendingCandidates(peerId, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        if (connection.localDescription) {
          await sendOfferOrAnswer(peerId, connection.localDescription, 'answer');
        }
      } catch (err) {
        console.warn('Offer konnte nicht verarbeitet werden', err);
      }
    },
    [applyPendingCandidates, createPeerConnection, sendOfferOrAnswer]
  );

  const handleAnswer = useCallback(
    async (payload: P2pOfferAnswerEnvelope) => {
      if (!payload.fromUserId || !payload.description) return;
      const peerId = String(payload.fromUserId);
      const connection = createPeerConnection(peerId, false);
      try {
        const description = payload.description as RTCSessionDescriptionInit;
        await connection.setRemoteDescription(description);
        await applyPendingCandidates(peerId, connection);
      } catch (err) {
        console.warn('Answer konnte nicht verarbeitet werden', err);
      }
    },
    [applyPendingCandidates, createPeerConnection]
  );

  const handleCandidateEnvelope = useCallback(
    async (payload: P2pCandidateEnvelope) => {
      if (!payload.fromUserId || !payload.candidate) return;
      const peerId = String(payload.fromUserId);
      const connection = createPeerConnection(peerId, false);
      const candidate = payload.candidate as RTCIceCandidateInit;
      if (connection.remoteDescription) {
        try {
          await connection.addIceCandidate(candidate);
        } catch (err) {
          console.warn('Candidate konnte nicht hinzugefügt werden', err);
        }
      } else {
        const list = pendingCandidatesRef.current.get(peerId) || [];
        list.push(candidate);
        pendingCandidatesRef.current.set(peerId, list);
      }
    },
    [createPeerConnection]
  );

  const handleIncomingSignal = useCallback(
    async (payload: P2pSignalEnvelope) => {
      if (!payload.fromUserId) return;
      const peerId = String(payload.fromUserId);
      const connection = createPeerConnection(peerId, false);

      if (payload.description) {
        try {
          const description = payload.description as RTCSessionDescriptionInit;
          await connection.setRemoteDescription(description);
          await applyPendingCandidates(peerId, connection);
          if (description.type === 'offer') {
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            if (connection.localDescription) {
              await sendOfferOrAnswer(peerId, connection.localDescription, 'answer');
            }
          }
        } catch (err) {
          console.warn('Remote Description konnte nicht gesetzt werden', err);
        }
      }

      if (payload.candidate) {
        const candidate = payload.candidate as RTCIceCandidateInit;
        if (connection.remoteDescription) {
          try {
            await connection.addIceCandidate(candidate);
          } catch (err) {
            console.warn('Candidate konnte nicht hinzugefügt werden', err);
          }
        } else {
          const list = pendingCandidatesRef.current.get(peerId) || [];
          list.push(candidate);
          pendingCandidatesRef.current.set(peerId, list);
        }
      }
    },
    [applyPendingCandidates, createPeerConnection, sendOfferOrAnswer]
  );

  const connectToChannel = useCallback(
    async (channelId: number, channelName: string) => {
      if (!socket) throw new Error('Socket nicht verbunden');
      if (connectingRef.current) return;

      connectingRef.current = true;
      activeChannelRef.current = channelId;

      setState({
        connectionState: 'connecting',
        activeChannelId: channelId,
        activeChannelName: channelName,
        providerId: 'p2p',
        error: null,
      });

      try {
        socket.emit('join_channel', channelId);

        const rtcConfig = getLiveKitConfig().connectOptions?.rtcConfig;
        if (rtcConfig) configRef.current = rtcConfig;

        const constraints: MediaStreamConstraints = {
          audio: settings.devices.audioInputId ? { deviceId: settings.devices.audioInputId } : true,
          video: false,
        };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = localStream;

        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !state.micMuted && !state.usePushToTalk;
        });

        updateParticipants();

        const join = await emitWithAck<P2pJoinAck>('p2pJoin', { channelId });
        const peers = (join.peers || []).map(
          (peer) =>
            ({
              id: String(peer.userId),
              username: peer.username,
              avatarUrl: peer.avatarUrl,
            }) as PeerProfile
        );

        peers.forEach((peer) => peerInfoRef.current.set(peer.id, peer));
        updateParticipants();

        peers.forEach((peer) => {
          createPeerConnection(peer.id, true);
        });

        setState({
          connectionState: 'connected',
          connectionHandle: { provider: 'p2p', sessionId: `channel_${channelId}` },
          activeChannelId: channelId,
          activeChannelName: channelName,
          providerId: 'p2p',
          error: null,
        });
      } catch (err: any) {
        console.warn('P2P Verbindung fehlgeschlagen', err);
        setState({ error: err?.message || 'Verbindung fehlgeschlagen', connectionState: 'disconnected', providerId: null });
        await disconnect();
      } finally {
        connectingRef.current = false;
      }
    },
    [createPeerConnection, disconnect, emitWithAck, setState, settings.devices.audioInputId, state.micMuted, state.usePushToTalk, updateParticipants, socket]
  );

  const disconnect = useCallback(async () => {
    const activeChannelId = activeChannelRef.current ?? state.activeChannelId;

    if (activeChannelId && optimisticLeave) {
      const user = storage.get('cloverUser') as { id?: number | string } | null;
      if (user?.id) optimisticLeave(activeChannelId, user.id);
      socket?.emit('leave_channel', activeChannelId);
    }

    cleanupAll();
    activeChannelRef.current = null;

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
  }, [cleanupAll, optimisticLeave, setState, socket, state.activeChannelId]);

  const setMicMuted = useCallback(
    async (muted: boolean) => {
      setState({ micMuted: muted });
      updateTalk({ micMuted: muted });
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !muted && !state.usePushToTalk;
      });
    },
    [setState, state.usePushToTalk, updateTalk]
  );

  const setPushToTalk = useCallback(
    async (enabled: boolean) => {
      setState({ usePushToTalk: enabled });
      updateTalk({ pushToTalkEnabled: enabled });
      if (enabled) {
        localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false));
      } else if (!state.micMuted) {
        localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = true));
      }
    },
    [setState, state.micMuted, updateTalk]
  );

  const startTalking = useCallback(async () => {
    if (!state.usePushToTalk) return;
    localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = true));
    setState({ isTalking: true });
  }, [setState, state.usePushToTalk]);

  const stopTalking = useCallback(async () => {
    if (!state.usePushToTalk) return;
    localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false));
    setState({ isTalking: false });
  }, [setState, state.usePushToTalk]);

  const setRnnoiseEnabled = useCallback(
    async (enabled: boolean) => {
      setState({
        rnnoiseEnabled: enabled,
        rnnoiseAvailable: false,
        rnnoiseError: 'RNNoise wird vom P2P-Provider nicht unterstützt.',
      });
    },
    [setState]
  );

  const unsupported = useCallback(
    async (message: string) => {
      setState({ cameraError: message, screenShareError: message });
    },
    [setState]
  );

  const startCamera = useCallback(async () => unsupported('Kamera wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);
  const stopCamera = useCallback(async () => unsupported('Kamera wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);
  const toggleCamera = useCallback(async () => unsupported('Kamera wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);
  const startScreenShare = useCallback(async () => unsupported('Screenshare wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);
  const stopScreenShare = useCallback(async () => unsupported('Screenshare wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);
  const toggleScreenShare = useCallback(async () => unsupported('Screenshare wird vom P2P-Client noch nicht unterstützt.'), [unsupported]);

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

      const el = audioElementsRef.current.get(participantId);
      if (el) {
        el.volume = calculateVolume(participantId, state.outputVolume, state.muted);
      }
    },
    [calculateVolume, settings.talk.participantVolumes, state.muted, state.outputVolume, updateTalk]
  );

  useEffect(() => {
    if (!socket) return;

    const handlePeerJoined = (payload: { channelId?: number; peer?: P2pPeerSummary }) => {
      if (!payload?.peer || payload.channelId !== activeChannelRef.current) return;
      const peer: PeerProfile = {
        id: String(payload.peer.userId),
        username: payload.peer.username,
        avatarUrl: payload.peer.avatarUrl,
      };
      peerInfoRef.current.set(peer.id, peer);
      updateParticipants();
      createPeerConnection(peer.id, true);
    };

    const handlePeerLeft = (payload: { channelId?: number; peerId?: number }) => {
      if (!payload?.peerId || payload.channelId !== activeChannelRef.current) return;
      cleanupPeer(String(payload.peerId));
      updateParticipants();
    };

    const handleOfferEvent = (payload: P2pOfferAnswerEnvelope) => {
      if (payload.channelId !== activeChannelRef.current) return;
      void handleOffer(payload);
    };

    const handleAnswerEvent = (payload: P2pOfferAnswerEnvelope) => {
      if (payload.channelId !== activeChannelRef.current) return;
      void handleAnswer(payload);
    };

    const handleCandidateEvent = (payload: P2pCandidateEnvelope) => {
      if (payload.channelId !== activeChannelRef.current) return;
      void handleCandidateEnvelope(payload);
    };

    const handleSignal = (payload: P2pSignalEnvelope) => {
      if (payload.channelId !== activeChannelRef.current) return;
      void handleIncomingSignal(payload);
    };

    socket.on(socketEvents.p2pPeerJoined, handlePeerJoined);
    socket.on(socketEvents.p2pPeerLeft, handlePeerLeft);
    socket.on(socketEvents.p2pOffer, handleOfferEvent);
    socket.on(socketEvents.p2pAnswer, handleAnswerEvent);
    socket.on(socketEvents.p2pCandidate, handleCandidateEvent);
    socket.on(socketEvents.p2pSignal, handleSignal);

    return () => {
      socket.off(socketEvents.p2pPeerJoined, handlePeerJoined);
      socket.off(socketEvents.p2pPeerLeft, handlePeerLeft);
      socket.off(socketEvents.p2pOffer, handleOfferEvent);
      socket.off(socketEvents.p2pAnswer, handleAnswerEvent);
      socket.off(socketEvents.p2pCandidate, handleCandidateEvent);
      socket.off(socketEvents.p2pSignal, handleSignal);
    };
  }, [cleanupPeer, createPeerConnection, handleAnswer, handleCandidateEnvelope, handleIncomingSignal, handleOffer, socket, updateParticipants]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const providerRenderers = useMemo<VoiceProviderRenderers>(
    () => ({
      AudioRenderer: () => (
        <HiddenAudioRenderer
          getAudioElements={() => audioElementsRef.current}
          renderRevision={audioRenderRevision}
          autoplayBlocked={autoplayBlocked}
          requestAutoplay={requestAutoplay}
        />
      ),
    }),
    [audioRenderRevision, autoplayBlocked, requestAutoplay]
  );

  return {
    providerId: 'p2p',
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
      peers: peerConnectionsRef.current,
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
