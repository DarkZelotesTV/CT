import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  DisconnectReason,
  LocalTrackPublication,
  RemoteAudioTrack,
  RemoteTrack,
} from 'livekit-client';
import rnnoiseWasmScriptUrl from '@jitsi/rnnoise-wasm/dist/rnnoise-sync.js?url';
import rnnoiseWorkletUrl from '../../../audio/rnnoise-worklet.js?url';
import { apiFetch } from '../../../api/http';
import { useSettings } from '../../../context/SettingsContext';
import { useSocket } from '../../../context/SocketContext';
import { getLiveKitConfig } from '../../../utils/apiConfig';
import { storage } from '../../../shared/config/storage';
import { type VoiceConnectionHandle, type VoiceParticipant, type VoiceProviderId } from '../providers/types';
import { liveKitRenderers } from '../providers/livekit/renderers';
import { type ConnectionState, VoiceState } from '../state/voiceTypes';

type QualityPreset = {
  resolution?: { width: number; height: number } | null;
  frameRate?: number | null;
};

const qualityPresets: Record<'low' | 'medium' | 'high' | 'native', QualityPreset> = {
  low: { resolution: { width: 640, height: 360 }, frameRate: 24 },
  medium: { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  high: { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
  native: { resolution: null, frameRate: null },
};

const bitrateProfiles = {
  low: { maxBitrate: 5_000_000 },
  medium: { maxBitrate: 7_500_000 },
  high: { maxBitrate: 10_000_000 },
  max: { maxBitrate: 15_000_000 },
};

export type VoiceEngineDeps = {
  state: VoiceState;
  setState: (patch: Partial<VoiceState> | ((prev: VoiceState) => Partial<VoiceState>)) => void;
  providerId?: VoiceProviderId;
};

export const useVoiceEngine = ({ state, setState, providerId: preferredProviderId = 'livekit' }: VoiceEngineDeps) => {
  const providerId = preferredProviderId ?? 'livekit';
  const { settings, updateTalk } = useSettings();
  const { socket, optimisticLeave } = useSocket();

  const {
    providerId: stateProviderId,
    connectionHandle,
    activeChannelId,
    activeChannelName,
    token,
    connectionState,
    error,
    participants,
    activeSpeakerIds,
    muted,
    micMuted,
    usePushToTalk,
    isTalking,
    isCameraEnabled,
    isScreenSharing,
    isPublishingCamera,
    isPublishingScreen,
    cameraError,
    screenShareError,
    screenShareAudioError,
    localParticipantId,
    shareSystemAudio,
    rnnoiseEnabled,
    rnnoiseAvailable,
    rnnoiseError,
    outputVolume,
    localAudioLevel,
  } = state;

  const roomRef = useRef<Room | null>(null);
  const [roomRevision, setRoomRevision] = useState(0);
  const setActiveChannelId = useCallback(
    (channelId: number | null) => setState({ activeChannelId: channelId }),
    [setState]
  );
  const setActiveChannelName = useCallback(
    (channelName: string | null) => setState({ activeChannelName: channelName }),
    [setState]
  );
  const setToken = useCallback((nextToken: string | null) => setState({ token: nextToken }), [setState]);
  const setConnectionState = useCallback((next: ConnectionState) => setState({ connectionState: next }), [setState]);
  const setError = useCallback((next: string | null) => setState({ error: next }), [setState]);
  const setMutedState = useCallback((next: boolean) => setState({ muted: next }), [setState]);
  const setMicMutedState = useCallback((next: boolean) => setState({ micMuted: next }), [setState]);
  const setUsePushToTalkState = useCallback((next: boolean) => setState({ usePushToTalk: next }), [setState]);
  const setIsTalking = useCallback((next: boolean) => setState({ isTalking: next }), [setState]);
  const setIsCameraEnabled = useCallback((next: boolean) => setState({ isCameraEnabled: next }), [setState]);
  const setIsScreenSharing = useCallback((next: boolean) => setState({ isScreenSharing: next }), [setState]);
  const setIsPublishingCamera = useCallback((next: boolean) => setState({ isPublishingCamera: next }), [setState]);
  const setIsPublishingScreen = useCallback((next: boolean) => setState({ isPublishingScreen: next }), [setState]);
  const setCameraError = useCallback((next: string | null) => setState({ cameraError: next }), [setState]);
  const setScreenShareError = useCallback(
    (next: string | null) => setState({ screenShareError: next }),
    [setState]
  );
  const setScreenShareAudioError = useCallback(
    (next: string | null) => setState({ screenShareAudioError: next }),
    [setState]
  );
  const setLocalParticipantId = useCallback(
    (next: string | null) => setState({ localParticipantId: next }),
    [setState]
  );
  const setShareSystemAudio = useCallback<Dispatch<SetStateAction<boolean>>>(
    (next) =>
      setState((prev) => ({
        shareSystemAudio: typeof next === 'function' ? next(prev.shareSystemAudio) : next,
      })),
    [setState]
  );
  const setRnnoiseEnabledState = useCallback(
    (next: boolean) => setState({ rnnoiseEnabled: next }),
    [setState]
  );
  const setRnnoiseAvailable = useCallback(
    (next: boolean) => setState({ rnnoiseAvailable: next }),
    [setState]
  );
  const setRnnoiseError = useCallback((next: string | null) => setState({ rnnoiseError: next }), [setState]);
  const setOutputVolumeState = useCallback((next: number) => setState({ outputVolume: next }), [setState]);
  const snapshotParticipants = useCallback(
    (room: Room | null): VoiceParticipant[] => {
      if (!room) return [];
      const list = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(Boolean);
      return list.map((participant) => ({
        id: String((participant as any)?.sid || (participant as any)?.identity || 'unknown'),
        name: String((participant as any)?.name || (participant as any)?.identity || 'User'),
        isLocal: Boolean((participant as any)?.isLocal),
        isMicrophoneEnabled: Boolean((participant as any)?.isMicrophoneEnabled ?? true),
        isCameraEnabled: Boolean((participant as any)?.isCameraEnabled),
        isScreenShareEnabled: Boolean((participant as any)?.isScreenShareEnabled),
        metadata: (participant as any)?.metadata ?? null,
      }));
    },
    []
  );
  const setActiveRoom = useCallback(
    (room: Room | null, handle?: VoiceConnectionHandle | null) => {
      roomRef.current = room;
      setRoomRevision((rev) => rev + 1);
      setState({
        connectionHandle: room
          ? handle ?? { provider: providerId, sessionId: room.name ?? room.sid ?? providerId }
          : null,
        providerId: room ? providerId : null,
        participants: snapshotParticipants(room),
        activeSpeakerIds: [],
      });
    },
    [setRoomRevision, setState, snapshotParticipants, providerId]
  );
  const syncParticipants = useCallback(
    (room?: Room | null) => {
      const targetRoom = room ?? roomRef.current;
      setState({ participants: snapshotParticipants(targetRoom) });
    },
    [setState, snapshotParticipants]
  );

  const publishedScreenTracksRef = useRef<MediaStreamTrack[]>([]);
  const rnnoiseResourcesRef = useRef<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    destination: MediaStreamAudioDestinationNode;
    rnnoiseNode: AudioWorkletNode | null;
    processedTrack: MediaStreamTrack;
    rawTrack: MediaStreamTrack;
    rawStream: MediaStream;
    publication: LocalTrackPublication | null;
  } | null>(null);
  const audioLevelMeterRef = useRef<{
    context: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    dataArray: Uint8Array;
    rafId: number | null;
    track: MediaStreamTrack;
  } | null>(null);

  const isConnecting = useRef(false);
  const attemptRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef(false);
  const lastChannelRef = useRef<{ id: number; name: string } | null>(null);
  const lastDisconnectReasonRef = useRef<string | null>(null);
  const joinedPresenceChannelRef = useRef<number | null>(null);
  const desiredMediaStateRef = useRef({
    muted: settings.talk.muted,
    micMuted: settings.talk.micMuted,
    pushToTalk: settings.talk.pushToTalkEnabled,
    cameraEnabled: false,
    screenSharing: false,
  });

  const lastAppliedPreferredDevicesRef = useRef<{
    audioInputId: string | null;
    audioOutputId: string | null;
    videoInputId: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') {
      setRnnoiseAvailable(false);
      setRnnoiseError('RNNoise erfordert AudioWorklet-Unterstützung.');
    }
  }, []);

  const leavePresenceChannel = useCallback(
    (channelId?: number | null) => {
      if (!socket) return;
      const target = channelId ?? joinedPresenceChannelRef.current;
      if (!target) return;
      socket.emit('leave_channel', target);
      if (joinedPresenceChannelRef.current === target) {
        joinedPresenceChannelRef.current = null;
      }
    },
    [socket]
  );

  const joinPresenceChannel = useCallback(
    (channelId: number) => {
      if (!socket) return;
      if (joinedPresenceChannelRef.current && joinedPresenceChannelRef.current !== channelId) {
        socket.emit('leave_channel', joinedPresenceChannelRef.current);
      }
      socket.emit('join_channel', channelId);
      joinedPresenceChannelRef.current = channelId;
    },
    [socket]
  );

  const stopRnnoisePipeline = useCallback(
    async (room?: Room | null) => {
      const resources = rnnoiseResourcesRef.current;
      if (!resources) return;

      rnnoiseResourcesRef.current = null;

      const { context, source, destination, rnnoiseNode, processedTrack, rawTrack, rawStream, publication } = resources;

      if (room && publication) {
        try {
          room.localParticipant.unpublishTrack(processedTrack, true);
        } catch (err) {
          console.warn('RNNoise-Track konnte nicht entfernt werden', err);
        }
      }

      try {
        processedTrack.stop();
      } catch (err) {
        console.warn('Gefilterter Track konnte nicht gestoppt werden', err);
      }

      try {
        rawTrack.stop();
      } catch (err) {
        console.warn('Quelltrack konnte nicht gestoppt werden', err);
      }

      try {
        rawStream.getTracks().forEach((t) => {
          if (t !== rawTrack) {
            t.stop();
          }
        });
      } catch (err) {
        console.warn('Quellstream konnte nicht bereinigt werden', err);
      }

      try {
        source.disconnect();
        rnnoiseNode?.disconnect();
        destination.disconnect();
      } catch (err) {
        console.warn('RNNoise-Knoten konnte nicht getrennt werden', err);
      }

      try {
        await context.close();
      } catch (err) {
        console.warn('Audiokontext konnte nicht geschlossen werden', err);
      }
    },
    []
  );

  const stopAudioLevelMeter = useCallback(() => {
    const meter = audioLevelMeterRef.current;
    if (!meter) return;

    if (meter.rafId) cancelAnimationFrame(meter.rafId);
    try {
      meter.source.disconnect();
      meter.analyser.disconnect();
    } catch (err) {
      console.warn('Pegelanzeige konnte nicht getrennt werden', err);
    }

    meter.context.close().catch(() => {});
    audioLevelMeterRef.current = null;
    setState({ localAudioLevel: 0 });
  }, [setState]);

  const startAudioLevelMeter = useCallback(
    async (track: MediaStreamTrack | null | undefined) => {
      if (!track || track.readyState !== 'live') {
        stopAudioLevelMeter();
        return;
      }

      if (audioLevelMeterRef.current?.track === track) return;

      stopAudioLevelMeter();

      try {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(new MediaStream([track]));
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);

        const meterState = {
          context,
          analyser,
          source,
          dataArray,
          rafId: null as number | null,
          track,
        };

        const updateLevel = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const sample = dataArray[i];
            if (sample === undefined) continue;
            const value = (sample - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const normalized = Math.min(1, rms * 4);
          setState({ localAudioLevel: normalized });
          meterState.rafId = requestAnimationFrame(updateLevel);
        };

        audioLevelMeterRef.current = meterState;
        await context.resume();
        updateLevel();
      } catch (err) {
        console.warn('Pegelanzeige konnte nicht gestartet werden', err);
        stopAudioLevelMeter();
      }
    },
    [setState, stopAudioLevelMeter]
  );

  const enableMicrophoneWithRnnoise = useCallback(
    async (room: Room) => {
      if (!rnnoiseEnabled) return false;

      if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') {
        setRnnoiseAvailable(false);
        setRnnoiseError('RNNoise wird von diesem Browser nicht unterstützt.');
        return false;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setRnnoiseAvailable(false);
        setRnnoiseError('Audioaufnahme wird von diesem Gerät nicht unterstützt.');
        return false;
      }

      try {
        setRnnoiseAvailable(true);
        const existing = rnnoiseResourcesRef.current;
        if (existing && existing.processedTrack?.readyState === 'live') {
          try {
            await existing.context.resume();
          } catch {
            /* noop */
          }
          try {
            (existing.publication as any)?.unmute?.();
          } catch {
            /* noop */
          }
          try {
            existing.processedTrack.enabled = true;
          } catch {
            /* noop */
          }
          try {
            await room.localParticipant.setMicrophoneEnabled(false);
          } catch {
            /* noop */
          }
          return true;
        }

        await stopRnnoisePipeline(room);

        const audioConstraints: MediaTrackConstraints | boolean = settings.devices.audioInputId
          ? { deviceId: settings.devices.audioInputId }
          : true;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        const rawTrack = stream.getAudioTracks()[0];
        if (!rawTrack) {
          throw new Error('Kein Audiotrack gefunden.');
        }

        const audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule(rnnoiseWorkletUrl);
        const rawStream = new MediaStream([rawTrack]);
        const source = audioContext.createMediaStreamSource(rawStream);
        
        const rnnoiseNode = new AudioWorkletNode(audioContext, 'rnnoise-processor', {
            processorOptions: {
                wasmUrl: rnnoiseWasmScriptUrl
            }
        });

        rnnoiseNode.port.onmessage = (event) => {
          if (event?.data?.type === 'error') {
            setRnnoiseError(event.data.message || 'RNNoise Fehler.');
          }
        };

        const destination = audioContext.createMediaStreamDestination();
        source.connect(rnnoiseNode).connect(destination);
        const processedTrack = destination.stream.getAudioTracks()[0];

        if (!processedTrack) {
          throw new Error('Gefilterter Audiotrack konnte nicht erstellt werden.');
        }

        await audioContext.resume();
        await room.localParticipant.setMicrophoneEnabled(false);

        const publication = await room.localParticipant.publishTrack(processedTrack, {
          name: 'microphone_rnnoise',
          source: Track.Source.Microphone,
        });

        rnnoiseResourcesRef.current = {
          context: audioContext,
          source,
          destination,
          rnnoiseNode,
          processedTrack,
          rawTrack,
          rawStream,
          publication,
        };

        setRnnoiseError(null);
        return true;
      } catch (err: any) {
        console.warn('RNNoise konnte nicht initialisiert werden', err);
        setRnnoiseError(err?.message || 'RNNoise konnte nicht initialisiert werden.');
        setRnnoiseAvailable(false);
        await stopRnnoisePipeline(room);
        return false;
      }
    },
    [rnnoiseEnabled, settings.devices.audioInputId, stopRnnoisePipeline]
  );

  const MAX_RECONNECT_ATTEMPTS = 3;
  const BASE_RECONNECT_DELAY = 1000;

  useEffect(() => {
    setMutedState(settings.talk.muted);
    setMicMutedState(settings.talk.micMuted);
    setUsePushToTalkState(settings.talk.pushToTalkEnabled);
    setRnnoiseEnabledState(settings.talk.rnnoiseEnabled ?? false);
    desiredMediaStateRef.current = {
      ...desiredMediaStateRef.current,
      muted: settings.talk.muted,
      micMuted: settings.talk.micMuted,
      pushToTalk: settings.talk.pushToTalkEnabled,
    };
  }, [settings.talk.micMuted, settings.talk.muted, settings.talk.pushToTalkEnabled, settings.talk.rnnoiseEnabled]);

  const syncLocalMediaState = useCallback((room: Room | null) => {
    if (!room) {
      setIsCameraEnabled(false);
      setIsScreenSharing(false);
      setLocalParticipantId(null);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, cameraEnabled: false, screenSharing: false };
      return;
    }

    const local = room.localParticipant;
    setIsCameraEnabled(!!local?.isCameraEnabled);
    setIsScreenSharing(!!local?.isScreenShareEnabled);
    setLocalParticipantId(local?.sid || local?.identity || null);
    desiredMediaStateRef.current = {
      ...desiredMediaStateRef.current,
      cameraEnabled: !!local?.isCameraEnabled,
      screenSharing: !!local?.isScreenShareEnabled,
    };
  }, []);

  const applyMicrophoneState = useCallback(
    async (
      room: Room | null,
      options?: { muted?: boolean; micMuted?: boolean; talking?: boolean; pushToTalk?: boolean }
    ) => {
      const isMuted = options?.muted ?? muted;
      const isMicMuted = options?.micMuted ?? micMuted;
      const talking = options?.talking ?? isTalking;
      const pushToTalk = options?.pushToTalk ?? usePushToTalk;
      const shouldEnable = !isMuted && !isMicMuted && (!pushToTalk || talking);
      if (!room) return;

      const safeStopRnnoise = async () => {
        try {
          await stopRnnoisePipeline(room);
        } catch (err) {
          console.warn('[voice] stopRnnoisePipeline failed', err);
        }
      };

      const safePauseRnnoise = async () => {
        const resources = rnnoiseResourcesRef.current;
        if (!resources) return;
        try {
          resources.processedTrack.enabled = false;
        } catch {
          /* noop */
        }
        try {
          (resources.publication as any)?.mute?.();
        } catch {
          /* noop */
        }
        try {
          await resources.context.suspend();
        } catch {
          /* noop */
        }
      };

      const safeSetMicrophoneEnabled = async (enabled: boolean) => {
        try {
          await room.localParticipant.setMicrophoneEnabled(enabled);
        } catch (err: any) {
          console.warn(`[voice] setMicrophoneEnabled(${enabled}) failed`, err);
          // Do not crash the renderer on mic init failures (common with stale device IDs / permissions).
          setError(err?.message || 'Mikrofon konnte nicht initialisiert werden.');
        }
      };

      if (!shouldEnable) {
        if (rnnoiseEnabled) {
          await safePauseRnnoise();
        } else {
          await safeStopRnnoise();
        }
        await safeSetMicrophoneEnabled(false);
        return;
      }

      if (rnnoiseEnabled) {
        const success = await enableMicrophoneWithRnnoise(room);
        if (success) return;
      }

      await safeStopRnnoise();
      await safeSetMicrophoneEnabled(true);
    },
    [enableMicrophoneWithRnnoise, isTalking, micMuted, muted, rnnoiseEnabled, stopRnnoisePipeline, usePushToTalk, setError]
  );

  const applyMicrophoneStateRef = useRef(applyMicrophoneState);
  useEffect(() => {
    applyMicrophoneStateRef.current = applyMicrophoneState;
  }, [applyMicrophoneState]);


  const setMuted = useCallback(
    async (nextMuted: boolean) => {
      setMutedState(nextMuted);
      updateTalk({ muted: nextMuted });
      if (nextMuted) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, muted: nextMuted };
      const room = roomRef.current;
      if (room) await applyMicrophoneState(room, { muted: nextMuted, talking: false });
    },
    [applyMicrophoneState, updateTalk]
  );

  const setMicMuted = useCallback(
    async (nextMuted: boolean) => {
      setMicMutedState(nextMuted);
      updateTalk({ micMuted: nextMuted });
      if (nextMuted) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, micMuted: nextMuted };
      const room = roomRef.current;
      if (room) await applyMicrophoneState(room, { micMuted: nextMuted, talking: false });
    },
    [applyMicrophoneState, updateTalk]
  );

  const setPushToTalk = useCallback(
    async (enabled: boolean) => {
      setUsePushToTalkState(enabled);
      updateTalk({ pushToTalkEnabled: enabled });
      if (!enabled) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, pushToTalk: enabled };
      const room = roomRef.current;
      if (room) await applyMicrophoneState(room, { pushToTalk: enabled, talking: false });
    },
    [applyMicrophoneState, updateTalk]
  );

  const setRnnoiseEnabled = useCallback(
    async (enabled: boolean) => {
      setRnnoiseEnabledState(enabled);
      updateTalk({ rnnoiseEnabled: enabled });
      if (!enabled) {
        setRnnoiseAvailable(true);
        setRnnoiseError(null);
        const room = roomRef.current;
        await stopRnnoisePipeline(room);
        if (room) {
          const shouldEnable = !muted && !micMuted && (!usePushToTalk || isTalking);
          await room.localParticipant.setMicrophoneEnabled(shouldEnable);
        }
        return;
      }

      setRnnoiseAvailable(true);
      setRnnoiseError(null);
      const room = roomRef.current;
      if (room) {
        await applyMicrophoneState(room, { talking: isTalking });
      }
    },
    [applyMicrophoneState, isTalking, micMuted, muted, stopRnnoisePipeline, updateTalk, usePushToTalk]
  );

  const applyOutputVolume = useCallback(
    (room: Room | null, volume: number) => {
      if (!room) return;
      const savedVolumes = settings.talk.participantVolumes || {};

      room.remoteParticipants.forEach((participant) => {
        const baseVolume = savedVolumes[participant.sid] ?? 1;
        if (typeof participant.setVolume === 'function') {
          participant.setVolume(baseVolume * volume);
        }
      });
    },
    [settings.talk.participantVolumes]
  );

  const setOutputVolume = useCallback(
    async (volume: number) => {
      const normalized = Math.max(0, Math.min(2, volume));
      setOutputVolumeState(normalized);
      updateTalk({ outputVolume: normalized });
      applyOutputVolume(roomRef.current, normalized);
    },
    [applyOutputVolume, updateTalk]
  );
  const setParticipantVolume = useCallback(
    (participantId: string, volume: number) => {
      const room = roomRef.current;
      if (!room) return;
      const participant = room.remoteParticipants.get(participantId);
      if (!participant) return;
      const normalized = Math.max(0, Math.min(2, volume));
      if (typeof participant.setVolume === 'function') {
        participant.setVolume(normalized * (outputVolume ?? 1));
      }
    },
    [outputVolume]
  );

  const applyOutputMuteState = useCallback(
    (room: Room | null, shouldEnable: boolean) => {
      if (!room) return;

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          const audioTrack = publication.audioTrack;
          if (audioTrack?.mediaStreamTrack) {
            audioTrack.mediaStreamTrack.enabled = shouldEnable;
          }
        });
      });
    },
    []
  );

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    applyOutputMuteState(room, !muted);

    const handleTrackSubscribed = (track: RemoteTrack, _publication: any, participant: any) => {
      if (track.kind === Track.Kind.Audio) {
        const audioTrack = track as RemoteAudioTrack;
        if (audioTrack.mediaStreamTrack) {
          audioTrack.mediaStreamTrack.enabled = !muted;
        }
        if (participant && typeof participant.setVolume === 'function') {
          const baseVolume = (settings.talk.participantVolumes || {})[participant.sid] ?? 1;
          participant.setVolume(baseVolume * outputVolume);
        }
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [applyOutputMuteState, muted, outputVolume, roomRevision, settings.talk.participantVolumes]);

  const startTalking = useCallback(async () => {
    setIsTalking(true);
    const room = roomRef.current;
    if (room) await applyMicrophoneState(room, { talking: true });
  }, [applyMicrophoneState]);

  const stopTalking = useCallback(async () => {
    setIsTalking(false);
    const room = roomRef.current;
    if (room) await applyMicrophoneState(room, { talking: false });
  }, [applyMicrophoneState]);

  const startCamera = useCallback(
    async (quality: 'low' | 'medium' | 'high' = 'medium', targetRoom?: Room | null) => {
      const roomToUse = targetRoom ?? roomRef.current;
      if (!roomToUse) {
        setCameraError('Keine aktive Voice-Verbindung für Video verfügbar.');
        return;
      }

      setIsPublishingCamera(true);
      setCameraError(null);

      try {
        const preset = qualityPresets[quality] || qualityPresets.medium;
        const captureOptions: {
          deviceId?: string;
          resolution?: { width: number; height: number };
          frameRate?: number;
        } = {
          ...(settings.devices.videoInputId ? { deviceId: settings.devices.videoInputId } : {}),
        };

        if (preset.resolution) captureOptions.resolution = preset.resolution;
        if (preset.frameRate != null) captureOptions.frameRate = preset.frameRate;

        await roomToUse.localParticipant.setCameraEnabled(true, captureOptions);
        desiredMediaStateRef.current = { ...desiredMediaStateRef.current, cameraEnabled: true };
        syncLocalMediaState(roomToUse);
      } catch (err: any) {
        console.error('Kamera konnte nicht gestartet werden', err);
        setCameraError(err?.message || 'Kamera konnte nicht gestartet werden.');
        setIsCameraEnabled(false);
      } finally {
        setIsPublishingCamera(false);
      }
    },
    [settings.devices.videoInputId, syncLocalMediaState]
  );

  const stopCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setIsCameraEnabled(false);
      return;
    }

    setIsPublishingCamera(true);
    try {
      await room.localParticipant.setCameraEnabled(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, cameraEnabled: false };
      syncLocalMediaState(room);
    } catch (err: any) {
      console.error('Kamera konnte nicht gestoppt werden', err);
      setCameraError(err?.message || 'Kamera konnte nicht gestoppt werden.');
    } finally {
      setIsPublishingCamera(false);
    }
  }, [syncLocalMediaState]);

  const toggleCamera = useCallback(async () => {
    if (isCameraEnabled) {
      await stopCamera();
    } else {
      await startCamera();
    }
  }, [isCameraEnabled, startCamera, stopCamera]);

  const startScreenShare = useCallback(
    async (
      options?: {
        sourceId?: string;
        quality?: 'low' | 'medium' | 'high' | 'native';
        frameRate?: number | 'native';
        track?: MediaStreamTrack;
        withAudio?: boolean;
        bitrateProfile?: 'low' | 'medium' | 'high' | 'max';
      }
    ) => {
      const roomToUse = roomRef.current;
      if (!roomToUse) {
        setScreenShareError('Keine aktive Voice-Verbindung für Screen-Sharing.');
        return;
      }

      setIsPublishingScreen(true);
      setScreenShareError(null);
      setScreenShareAudioError(null);
      publishedScreenTracksRef.current = [];

      if (options?.track && options.track.readyState === 'ended') {
        setScreenShareError('Die ausgewählte Bildschirmquelle ist nicht mehr aktiv.');
        setIsPublishingScreen(false);
        return;
      }

      const preset = options?.quality ? qualityPresets[options.quality] ?? qualityPresets.high : qualityPresets.high;
      const preferredFrameRate = options?.frameRate === 'native' ? null : options?.frameRate ?? preset.frameRate ?? null;
      const shouldShareAudio = options?.withAudio ?? shareSystemAudio;
      const bitrateProfile = options?.bitrateProfile ?? settings.talk.screenBitrateProfile ?? 'medium';
      const selectedBitrate = bitrateProfiles[bitrateProfile] ?? bitrateProfiles.medium;

      const applySenderBitrate = (sender?: RTCRtpSender | null) => {
        if (!sender) return;
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) return;
        const nextEncodings = params.encodings.map((encoding) => ({ ...encoding, maxBitrate: selectedBitrate.maxBitrate }));
        sender
          .setParameters({ ...params, encodings: nextEncodings })
          .catch((err) => console.warn('Konnte RTCRtpSendParameters nicht setzen', err));
      };

      const applySystemAudioFilter = (track: MediaStreamTrack | null | undefined) => {
        if (!track) return track;
        const filterHook = window.clover?.filterSystemAudioTrack;
        if (typeof filterHook === 'function') {
          try {
            const filtered = filterHook(track);
            if (filtered) return filtered;
          } catch (err) {
            console.warn('Systemaudio-Filter konnte nicht angewendet werden', err);
            setScreenShareAudioError('Systemaudio-Filter konnte nicht angewendet werden. Es wird der Original-Stream genutzt.');
          }
        }
        return track;
      };

      if (window.ct?.getScreenSources) {
        try {
          const sourceId = options?.sourceId;

          if (!sourceId && !options?.track) {
            const sources = await window.ct.getScreenSources();
            const fallbackId = sources[0]?.id;

            if (!fallbackId) {
              throw new Error('Keine Bildschirme gefunden.');
            }
            options = { ...options, sourceId: fallbackId };
          }

          let selectedTrack = options?.track;
          let systemAudioTrack: MediaStreamTrack | null = null;

          if (!selectedTrack || (shouldShareAudio && !systemAudioTrack)) {
            const videoConstraints: any = {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: options?.sourceId,
              }
            };

            if (preset.resolution?.width && preset.resolution?.height) {
              videoConstraints.mandatory.minWidth = preset.resolution.width;
              videoConstraints.mandatory.maxWidth = preset.resolution.width;
              videoConstraints.mandatory.minHeight = preset.resolution.height;
              videoConstraints.mandatory.maxHeight = preset.resolution.height;
            }

            if (preferredFrameRate) {
              videoConstraints.mandatory.minFrameRate = preferredFrameRate;
              videoConstraints.mandatory.maxFrameRate = preferredFrameRate;
            }

            const audioConstraints: any = shouldShareAudio
              ? {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: options?.sourceId,
                  }
                }
              : false;

            const stream = await navigator.mediaDevices.getUserMedia({
              audio: shouldShareAudio ? audioConstraints : false,
              video: videoConstraints,
            });
            const streamVideoTrack = stream.getVideoTracks()[0];
            selectedTrack = selectedTrack ?? streamVideoTrack;
            systemAudioTrack = shouldShareAudio ? stream.getAudioTracks()[0] ?? null : null;

            if (streamVideoTrack && selectedTrack !== streamVideoTrack) {
              streamVideoTrack.stop();
            }
          }

          if (!selectedTrack || selectedTrack.readyState === 'ended') {
            throw new Error('Kein Videotrack für Screenshare gefunden.');
          }

          if ('contentHint' in selectedTrack) {
            selectedTrack.contentHint = 'motion';
          }

          const publication = await roomToUse.localParticipant.publishTrack(selectedTrack, {
            name: 'screen_share',
            source: Track.Source.ScreenShare,
            simulcast: false,
            videoEncoding: {
              maxBitrate: selectedBitrate.maxBitrate,
              ...(preferredFrameRate ? { maxFramerate: preferredFrameRate } : {}),
            },
          });
          applySenderBitrate((publication as any)?.track?.sender ?? (publication as any)?.sender);

          if (shouldShareAudio) {
            const filteredAudioTrack = applySystemAudioFilter(systemAudioTrack);
            if (filteredAudioTrack && filteredAudioTrack.readyState !== 'ended') {
              await roomToUse.localParticipant.publishTrack(filteredAudioTrack, {
                name: 'screen_share_audio',
                source: Track.Source.ScreenShareAudio,
              });
              publishedScreenTracksRef.current.push(filteredAudioTrack);
              setScreenShareAudioError(null);
            } else {
              setScreenShareAudioError('Systemaudio konnte nicht aufgenommen werden. Freigabe läuft ohne Ton.');
            }
          }

          publishedScreenTracksRef.current.push(selectedTrack);

          desiredMediaStateRef.current = { ...desiredMediaStateRef.current, screenSharing: true };
          syncLocalMediaState(roomToUse);
        } catch (err: any) {
          console.error('Electron Screenshare Error', err);
          setScreenShareError(err?.message || 'Konnte Screenshare in App nicht starten.');
          setIsScreenSharing(false);
        } finally {
          setIsPublishingScreen(false);
        }
        return;
      }

      try {
        let stream: MediaStream | null = null;
        let videoTrack: MediaStreamTrack | null = null;
        let audioTrack: MediaStreamTrack | null = null;

        if (!shouldShareAudio && options?.track) {
          videoTrack = options.track;
        } else {
          const videoConstraints: MediaTrackConstraints = {};

          if (preset.resolution?.width && preset.resolution?.height) {
            videoConstraints.width = preset.resolution.width;
            videoConstraints.height = preset.resolution.height;
          }

          if (preferredFrameRate) {
            videoConstraints.frameRate = { ideal: preferredFrameRate, max: preferredFrameRate };
          }

          stream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: shouldShareAudio
              ? ({
                  suppressLocalAudioPlayback: false,
                  // Verhindert, dass die eigene CloverTalk-App-Audio beim Screenshare mitgeschickt wird
                  // und sich Teilnehmende selbst hören.
                  selfBrowserSurface: 'exclude',
                } as MediaTrackConstraints)
              : false,
          });

          const streamVideoTrack = stream.getVideoTracks()[0];
          videoTrack = options?.track ?? streamVideoTrack ?? null;
          audioTrack = shouldShareAudio ? stream.getAudioTracks()[0] ?? null : null;

          if (streamVideoTrack && videoTrack !== streamVideoTrack) {
            streamVideoTrack.stop();
          }
        }

        if (!videoTrack || videoTrack.readyState === 'ended') {
          throw new Error('Kein Videotrack für Screenshare gefunden.');
        }

        if ('contentHint' in videoTrack) {
          videoTrack.contentHint = 'motion';
        }

        const publication = await roomToUse.localParticipant.publishTrack(videoTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare,
          simulcast: false,
          videoEncoding: {
            maxBitrate: selectedBitrate.maxBitrate,
            ...(preferredFrameRate ? { maxFramerate: preferredFrameRate } : {}),
          },
        });
        applySenderBitrate((publication as any)?.track?.sender ?? (publication as any)?.sender);

        if (shouldShareAudio) {
          const filteredAudioTrack = applySystemAudioFilter(audioTrack);
          if (filteredAudioTrack && filteredAudioTrack.readyState !== 'ended') {
            await roomToUse.localParticipant.publishTrack(filteredAudioTrack, {
              name: 'screen_share_audio',
              source: Track.Source.ScreenShareAudio,
            });
            publishedScreenTracksRef.current.push(filteredAudioTrack);
            setScreenShareAudioError(null);
          } else {
            setScreenShareAudioError('Systemaudio konnte nicht aufgenommen werden. Freigabe läuft ohne Ton.');
          }
        }

        publishedScreenTracksRef.current.push(videoTrack);

        desiredMediaStateRef.current = { ...desiredMediaStateRef.current, screenSharing: true };
        syncLocalMediaState(roomToUse);
    } catch (err: any) {
      console.error('Screenshare konnte nicht gestartet werden', err);
      setScreenShareError(err?.message || 'Screenshare konnte nicht gestartet werden.');
      setIsScreenSharing(false);
    } finally {
      setIsPublishingScreen(false);
    }
  },
    [settings.talk.screenBitrateProfile, shareSystemAudio, syncLocalMediaState]
  );

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setIsScreenSharing(false);
      setScreenShareAudioError(null);
      return;
    }
    setIsPublishingScreen(true);
    try {
      const publishedTracks = publishedScreenTracksRef.current;
      if (publishedTracks.length) {
        for (const track of publishedTracks) {
          try {
            room.localParticipant.unpublishTrack(track, true);
          } catch (unpublishError) {
            console.warn('Track konnte nicht unpublisht werden', unpublishError);
          }
          try {
            track.stop();
          } catch (stopError) {
            console.warn('Track konnte nicht gestoppt werden', stopError);
          }
        }
        publishedScreenTracksRef.current = [];
        setScreenShareAudioError(null);
        desiredMediaStateRef.current = { ...desiredMediaStateRef.current, screenSharing: false };
        syncLocalMediaState(room);
      } else {
        await room.localParticipant.setScreenShareEnabled(false);
        desiredMediaStateRef.current = { ...desiredMediaStateRef.current, screenSharing: false };
        syncLocalMediaState(room);
      }
    } catch (err: any) {
      console.error('Screenshare konnte nicht gestoppt werden', err);
      setScreenShareError(err?.message || 'Screenshare konnte nicht gestoppt werden.');
    } finally {
      setIsPublishingScreen(false);
    }
  }, [syncLocalMediaState]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // FIX: disconnect ist nun robust gegen Fehler beim Beenden des Raumes
  const disconnect = useCallback(async () => {
    console.warn('[voice] disconnect() called', new Error().stack);

    // Optimistic Leave Trigger
    if (activeChannelId && optimisticLeave) {
       try {
         const user = storage.get('cloverUser');
         if (user?.id) {
           optimisticLeave(activeChannelId, Number(user.id));
           console.log('[voice] Optimistic Leave performed for user', user.id);
         }
       } catch (e) {
         console.warn('Could not perform optimistic leave', e);
       }
    }

    manualDisconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isConnecting.current = false;

    // Versuche, Audio-Pipeline sauber zu stoppen
    try {
      await stopRnnoisePipeline(roomRef.current);
    } catch (err) {
      console.warn('Fehler beim Stoppen von RNNoise:', err);
    }

    // Versuche, Raum sauber zu verlassen
    try {
      const room = roomRef.current;
      if (room) {
        await room.disconnect();
      }
    } catch (err) {
      console.warn('Fehler beim Disconnecten des Raumes (State wird trotzdem resettet):', err);
    } finally {
      // GARANTIERTES STATE-RESET
      setActiveRoom(null);
      setActiveChannelId(null);
      setActiveChannelName(null);
      leavePresenceChannel();
      setToken(null);
      setConnectionState('disconnected');
      setIsTalking(false);
      setIsCameraEnabled(false);
      setIsScreenSharing(false);
      setIsPublishingCamera(false);
      setIsPublishingScreen(false);
      setCameraError(null);
      setScreenShareError(null);
      setScreenShareAudioError(null);
      publishedScreenTracksRef.current.forEach((t) => {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      });
      publishedScreenTracksRef.current = [];
      setLocalParticipantId(null);
      syncParticipants(null);
    }
  }, [activeChannelId, leavePresenceChannel, optimisticLeave, stopRnnoisePipeline, syncParticipants]);

  const finalizeDisconnection = useCallback(
    (message: string | null) => {
      setConnectionState('disconnected');
      setActiveRoom(null);
      setActiveChannelId(null);
      setActiveChannelName(null);
      leavePresenceChannel();
      setToken(null);
      setError(message ?? null);
      syncLocalMediaState(null);
      isConnecting.current = false;
    },
    [leavePresenceChannel, syncLocalMediaState]
  );

  const restoreMediaState = useCallback(
    async (room: Room) => {
      const desired = desiredMediaStateRef.current;
      await applyMicrophoneState(room, {
        muted: desired.muted,
        micMuted: desired.micMuted,
        pushToTalk: desired.pushToTalk,
        talking: false,
      });

      if (desired.cameraEnabled && !room.localParticipant.isCameraEnabled) {
        await startCamera('medium');
      }

      if (desired.screenSharing && !room.localParticipant.isScreenShareEnabled) {
        await startScreenShare(undefined);
      }
    },
    [applyMicrophoneState, startCamera, startScreenShare]
  );

  const connectToChannel = useCallback(
    async (channelId: number, channelName: string, options?: { isReconnect?: boolean }) => {
      const attempt = ++attemptRef.current;
      if (activeChannelId === channelId && connectionState === 'connected') return;
      if (isConnecting.current) return;

      manualDisconnectRef.current = false;
      lastChannelRef.current = { id: channelId, name: channelName };
      reconnectAttemptsRef.current = options?.isReconnect ? reconnectAttemptsRef.current : 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const existingRoom = roomRef.current;
      if (existingRoom) {
        await stopRnnoisePipeline(existingRoom);
        // Auch hier ein try-catch, falls der alte Raum hängt
        try {
          await existingRoom.disconnect();
        } catch (e) {
          console.warn("Fehler beim Disconnect des alten Raums:", e);
        }
      }

      if (activeChannelId) {
        leavePresenceChannel(activeChannelId);
      }

      isConnecting.current = true;
      setConnectionState(options?.isReconnect ? 'reconnecting' : 'connecting');
      setError(null);

      try {
        const lkConfig = getLiveKitConfig();
        const roomName = `channel_${channelId}`;

        const res = await apiFetch<{ token: string }>(`/api/livekit/token?room=${roomName}`);
        const newToken = res.token;
        setToken(newToken);

        joinPresenceChannel(channelId);

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: { simulcast: true },
        });

        room.setMaxListeners(100);

        room.on(RoomEvent.Disconnected, (reason) => {
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            console.warn('[voice] Disconnected due to DUPLICATE_IDENTITY. Stopping reconnect loop.');
            finalizeDisconnection('Verbindung beendet: Sie haben sich von einem anderen Gerät angemeldet.');
            return;
          }

          const disconnectReason =
            typeof reason === 'string'
              ? reason
              : (reason as any)?.reason || (reason as any)?.message || 'Unbekannter Verbindungsfehler';
          lastDisconnectReasonRef.current = disconnectReason;
          console.warn('[voice] Room disconnected', disconnectReason, reason);
          isConnecting.current = false;

          const channel = lastChannelRef.current;
          if (channel) {
            leavePresenceChannel(channel.id);
          }

          if (manualDisconnectRef.current) {
            finalizeDisconnection(null);
            return;
          }

          if (!channel) {
            finalizeDisconnection(disconnectReason);
            return;
          }

          const attemptReconnect = () => {
            if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
              finalizeDisconnection(
                `Verbindung getrennt (${disconnectReason}). Erneute Verbindung nicht möglich. Letzter Fehler: ${
                  lastDisconnectReasonRef.current || disconnectReason
                }`
              );
              return;
            }

            reconnectAttemptsRef.current += 1;
            const delay = reconnectAttemptsRef.current === 1
              ? 0
              : Math.min(5000, BASE_RECONNECT_DELAY * 2 ** (reconnectAttemptsRef.current - 1));
            setConnectionState('reconnecting');
            setError(null);
            console.warn(
              `[voice] Reconnect attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
            );
            reconnectTimeoutRef.current = setTimeout(async () => {
              try {
                await connectToChannel(channel.id, channel.name, { isReconnect: true });
              } catch (reconnectError: any) {
                lastDisconnectReasonRef.current = reconnectError?.message ?? disconnectReason;
                setError(reconnectError?.message || disconnectReason);
                attemptReconnect();
              }
            }, delay);
          };

          attemptReconnect();
        });

        room.on(RoomEvent.Connected, () => {
          setConnectionState('connected');
          setError(null);
          reconnectAttemptsRef.current = 0;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          isConnecting.current = false;
          syncLocalMediaState(room);

          // IMPORTANT: EventEmitter ignores returned promises; avoid unhandled rejections that can crash Electron.
          const safeRestoreMediaState = () => {
            void restoreMediaState(room).catch((err) => {
              console.warn('[voice] restoreMediaState failed', err);
            });
          };

          safeRestoreMediaState();
        });

        room.on(RoomEvent.Reconnecting, () => {
          setConnectionState('reconnecting');
          console.warn('[voice] Reconnecting');
        });

        room.on(RoomEvent.Reconnected, () => {
          setConnectionState('connected');
          setError(null);
          reconnectAttemptsRef.current = 0;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          console.warn('[voice] Reconnected');

          void restoreMediaState(room).catch((err) => {
            console.warn('[voice] restoreMediaState failed after reconnect', err);
          });
        });

        const handleTrackChange = () => syncLocalMediaState(room);
        room.on(RoomEvent.LocalTrackPublished, handleTrackChange);
        room.on(RoomEvent.LocalTrackUnpublished, handleTrackChange);
        room.on(RoomEvent.TrackMuted, handleTrackChange);
        room.on(RoomEvent.TrackUnmuted, handleTrackChange);

        await room.connect(lkConfig.serverUrl, newToken, lkConfig.connectOptions);
        if (settings.devices.audioInputId) {
          await room.switchActiveDevice('audioinput', settings.devices.audioInputId, true);
        }
        if (settings.devices.audioOutputId) {
          await room.switchActiveDevice('audiooutput', settings.devices.audioOutputId, true);
        }
        if (settings.devices.videoInputId) {
          await room.switchActiveDevice('videoinput', settings.devices.videoInputId, true);
        }
        if (attemptRef.current !== attempt) {
          room.disconnect();
          return;
        }
        await applyMicrophoneState(room);

        setActiveRoom(room, { provider: 'livekit', sessionId: roomName, meta: { channelId } });
        setActiveChannelId(channelId);
        setActiveChannelName(channelName);
        syncParticipants(room);

      } catch (err: any) {
        console.error("Voice Connection Failed:", err);
        setError(err.message || 'Verbindung fehlgeschlagen');
        setConnectionState(options?.isReconnect ? 'reconnecting' : 'disconnected');
        syncLocalMediaState(null);
        setIsPublishingCamera(false);
        setIsPublishingScreen(false);
        isConnecting.current = false;
        leavePresenceChannel(channelId);
        if (options?.isReconnect) {
          lastDisconnectReasonRef.current = err?.message || null;
          throw err;
        }
      }
    },
    [
      activeChannelId,
      applyMicrophoneState,
      connectionState,
      finalizeDisconnection,
      stopRnnoisePipeline,
      settings.devices.audioInputId,
      settings.devices.audioOutputId,
      settings.devices.videoInputId,
      restoreMediaState,
      joinPresenceChannel,
      leavePresenceChannel,
      syncLocalMediaState,
      syncParticipants,
    ]
  );

  useEffect(() => {
    if (!socket) return;

    const handleForceDisconnect = (payload?: { reason?: string }) => {
      const reason = payload?.reason || 'Du wurdest aus dem Talk entfernt.';
      disconnect().catch(() => {});
      finalizeDisconnection(reason);
      setError(reason);
    };

    const handleForceMove = (payload?: { toChannelId?: number; toChannelName?: string }) => {
      if (!payload?.toChannelId) return;
      const targetName = payload.toChannelName || `Talk ${payload.toChannelId}`;
      connectToChannel(payload.toChannelId, targetName).catch((err: any) => {
        const message = err?.message || 'Konnte den Talk nicht betreten.';
        setError(message);
      });
    };

    const handleForceMute = () => {
      setMicMuted(true);
      setMuted(true);
    };

    socket.on('voice:force-disconnect', handleForceDisconnect);
    socket.on('voice:force-move', handleForceMove);
    socket.on('voice:force-mute', handleForceMute);

    return () => {
      socket.off('voice:force-disconnect', handleForceDisconnect);
      socket.off('voice:force-move', handleForceMove);
      socket.off('voice:force-mute', handleForceMute);
    };
  }, [socket, disconnect, finalizeDisconnection, connectToChannel, setMicMuted, setMuted]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room) {
      setState({ participants: [], activeSpeakerIds: [] });
      return;
    }

    const handleParticipantsChanged = () => syncParticipants(room);
    const handleActiveSpeakersChanged = (speakers: any[]) => {
      setState({
        activeSpeakerIds: (speakers || []).map((speaker) => String((speaker as any)?.sid || (speaker as any)?.identity || '')),
      });
    };

    handleParticipantsChanged();
    room.on(RoomEvent.ParticipantConnected, handleParticipantsChanged);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantsChanged);
    room.on(RoomEvent.TrackPublished, handleParticipantsChanged);
    room.on(RoomEvent.TrackUnpublished, handleParticipantsChanged);
    room.on(RoomEvent.TrackMuted, handleParticipantsChanged);
    room.on(RoomEvent.TrackUnmuted, handleParticipantsChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantsChanged);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantsChanged);
      room.off(RoomEvent.TrackPublished, handleParticipantsChanged);
      room.off(RoomEvent.TrackUnpublished, handleParticipantsChanged);
      room.off(RoomEvent.TrackMuted, handleParticipantsChanged);
      room.off(RoomEvent.TrackUnmuted, handleParticipantsChanged);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    };
  }, [roomRevision, setState, syncParticipants]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    let disposed = false;

    const next = {
      audioInputId: settings.devices.audioInputId ?? null,
      audioOutputId: settings.devices.audioOutputId ?? null,
      videoInputId: settings.devices.videoInputId ?? null,
    };

    const prev = lastAppliedPreferredDevicesRef.current;
    lastAppliedPreferredDevicesRef.current = next;

    const applyPreferredDevices = async () => {
      try {
        if (!disposed && next.audioInputId && prev?.audioInputId !== next.audioInputId) {
          await room.switchActiveDevice('audioinput', next.audioInputId, true);
        }
        if (!disposed && next.audioOutputId && prev?.audioOutputId !== next.audioOutputId) {
          await room.switchActiveDevice('audiooutput', next.audioOutputId, true);
        }
        if (!disposed && next.videoInputId && prev?.videoInputId !== next.videoInputId) {
          await room.switchActiveDevice('videoinput', next.videoInputId, true);
        }

        if (!disposed) {
          await applyMicrophoneStateRef.current(room);
        }
      } catch (err) {
        console.warn('Could not apply preferred devices', err);
      }
    };

    void applyPreferredDevices();

    return () => {
      disposed = true;
    };
  }, [roomRevision, settings.devices.audioInputId, settings.devices.audioOutputId, settings.devices.videoInputId]);

  useEffect(() => {
    applyOutputVolume(roomRef.current, outputVolume);
  }, [applyOutputVolume, outputVolume, roomRevision]);

  useEffect(() => {
    const shouldMeasure =
      connectionState === 'connected' && !muted && !micMuted && (!usePushToTalk || isTalking);

    const room = roomRef.current;
    if (!room || !shouldMeasure) {
      setState({ localAudioLevel: 0 });
      stopAudioLevelMeter();
      return;
    }

    const rnnoiseTrack = rnnoiseResourcesRef.current?.processedTrack;
    // LiveKit v2 types no longer expose `audioTracks`; use a source-based lookup.
    const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const liveKitTrack =
      (publication as LocalTrackPublication | undefined)?.track?.mediaStreamTrack ?? null;
    const track = rnnoiseTrack?.readyState === 'live' ? rnnoiseTrack : liveKitTrack;

    startAudioLevelMeter(track);
  }, [connectionState, isTalking, micMuted, muted, roomRevision, setState, startAudioLevelMeter, stopAudioLevelMeter, usePushToTalk]);

  useEffect(() => () => stopAudioLevelMeter(), [stopAudioLevelMeter]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room) {
      syncLocalMediaState(null);
      return;
    }

    syncLocalMediaState(room);
  }, [roomRevision, syncLocalMediaState]);

  const contextValue: VoiceContextType = {
    providerId: stateProviderId,
    connectionHandle,
    activeChannelId,
    activeChannelName,
    connectionState,
    error,
    cameraError,
    screenShareError,
    participants,
    activeSpeakerIds,
    connectToChannel,
    disconnect,
    getNativeHandle: () => roomRef.current,
    token,
    muted,
    micMuted,
    usePushToTalk,
    isTalking,
    isCameraEnabled,
    isScreenSharing,
    isPublishingCamera,
    isPublishingScreen,
    rnnoiseEnabled,
    rnnoiseAvailable,
    rnnoiseError,
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
    shareSystemAudio,
    setShareSystemAudio,
    selectedAudioInputId: settings.devices.audioInputId,
    selectedAudioOutputId: settings.devices.audioOutputId,
    selectedVideoInputId: settings.devices.videoInputId,
    localParticipantId,
    outputVolume,
    setOutputVolume,
    setParticipantVolume,
    screenShareAudioError,
    localAudioLevel,
    providerRenderers: liveKitRenderers,
  };

  return contextValue;
};
