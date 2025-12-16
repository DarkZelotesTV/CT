import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  DisconnectReason,
  LocalTrackPublication,
  RemoteAudioTrack,
  RemoteTrack,
} from 'livekit-client';
import { getLiveKitConfig } from '../utils/apiConfig';
import { VoiceContext, VoiceContextType } from './voice-state';
import { apiFetch } from '../api/http';
import { useSettings } from './SettingsContext';
import rnnoiseWorkletUrl from '../audio/rnnoise-worklet.js?url';

const qualityPresets = {
  low: { resolution: { width: 640, height: 360 }, frameRate: 24 },
  medium: { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  high: { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
};

const bitrateProfiles = {
  low: { maxBitrate: 800_000 },
  standard: { maxBitrate: 1_800_000 },
  high: { maxBitrate: 3_500_000 },
};

export const VoiceProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings, updateTalk } = useSettings();

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<VoiceContextType['connectionState']>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(settings.talk.muted);
  const [micMuted, setMicMutedState] = useState(settings.talk.micMuted);
  const [usePushToTalk, setUsePushToTalkState] = useState(settings.talk.pushToTalkEnabled);
  const [isTalking, setIsTalking] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPublishingCamera, setIsPublishingCamera] = useState(false);
  const [isPublishingScreen, setIsPublishingScreen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [screenShareAudioError, setScreenShareAudioError] = useState<string | null>(null);
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);
  const [shareSystemAudio, setShareSystemAudio] = useState(false);
  const [rnnoiseEnabled, setRnnoiseEnabledState] = useState(settings.talk.rnnoiseEnabled ?? false);
  const [rnnoiseAvailable, setRnnoiseAvailable] = useState(true);
  const [rnnoiseError, setRnnoiseError] = useState<string | null>(null);

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

  const isConnecting = useRef(false);
  const attemptRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef(false);
  const lastChannelRef = useRef<{ id: number; name: string } | null>(null);
  const lastDisconnectReasonRef = useRef<string | null>(null);
  const desiredMediaStateRef = useRef({
    muted: settings.talk.muted,
    micMuted: settings.talk.micMuted,
    pushToTalk: settings.talk.pushToTalkEnabled,
    cameraEnabled: false,
    screenSharing: false,
  });

  useEffect(() => {
    if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') {
      setRnnoiseAvailable(false);
      setRnnoiseError('RNNoise erfordert AudioWorklet-Unterstützung.');
    }
  }, []);

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
        await stopRnnoisePipeline(room);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: settings.devices.audioInputId || undefined },
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
        const rnnoiseNode = new AudioWorkletNode(audioContext, 'rnnoise-processor');

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

      if (!shouldEnable) {
        await stopRnnoisePipeline(room);
        await room.localParticipant.setMicrophoneEnabled(false);
        return;
      }

      if (rnnoiseEnabled) {
        const success = await enableMicrophoneWithRnnoise(room);
        if (success) return;
      }

      await stopRnnoisePipeline(room);
      await room.localParticipant.setMicrophoneEnabled(true);
    },
    [enableMicrophoneWithRnnoise, isTalking, micMuted, muted, rnnoiseEnabled, stopRnnoisePipeline, usePushToTalk]
  );

  const setMuted = useCallback(
    async (nextMuted: boolean) => {
      setMutedState(nextMuted);
      updateTalk({ muted: nextMuted });
      if (nextMuted) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, muted: nextMuted };
      if (activeRoom) await applyMicrophoneState(activeRoom, { muted: nextMuted, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const setMicMuted = useCallback(
    async (nextMuted: boolean) => {
      setMicMutedState(nextMuted);
      updateTalk({ micMuted: nextMuted });
      if (nextMuted) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, micMuted: nextMuted };
      if (activeRoom) await applyMicrophoneState(activeRoom, { micMuted: nextMuted, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const setPushToTalk = useCallback(
    async (enabled: boolean) => {
      setUsePushToTalkState(enabled);
      updateTalk({ pushToTalkEnabled: enabled });
      if (!enabled) setIsTalking(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, pushToTalk: enabled };
      if (activeRoom) await applyMicrophoneState(activeRoom, { pushToTalk: enabled, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const setRnnoiseEnabled = useCallback(
    async (enabled: boolean) => {
      setRnnoiseEnabledState(enabled);
      updateTalk({ rnnoiseEnabled: enabled });
      if (!enabled) {
        setRnnoiseAvailable(true);
        setRnnoiseError(null);
        await stopRnnoisePipeline(activeRoom);
        if (activeRoom) {
          const shouldEnable = !muted && !micMuted && (!usePushToTalk || isTalking);
          await activeRoom.localParticipant.setMicrophoneEnabled(shouldEnable);
        }
        return;
      }

      setRnnoiseAvailable(true);
      setRnnoiseError(null);
      if (activeRoom) {
        await applyMicrophoneState(activeRoom, { talking: isTalking });
      }
    },
    [activeRoom, applyMicrophoneState, isTalking, micMuted, muted, stopRnnoisePipeline, updateTalk, usePushToTalk]
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
    if (!activeRoom) return;

    applyOutputMuteState(activeRoom, !muted);

    const handleTrackSubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const audioTrack = track as RemoteAudioTrack;
        if (audioTrack.mediaStreamTrack) {
          audioTrack.mediaStreamTrack.enabled = !muted;
        }
      }
    };

    activeRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    return () => {
      activeRoom.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [activeRoom, applyOutputMuteState, muted]);

  const startTalking = useCallback(async () => {
    setIsTalking(true);
    if (activeRoom) await applyMicrophoneState(activeRoom, { talking: true });
  }, [activeRoom, applyMicrophoneState]);

  const stopTalking = useCallback(async () => {
    setIsTalking(false);
    if (activeRoom) await applyMicrophoneState(activeRoom, { talking: false });
  }, [activeRoom, applyMicrophoneState]);

  const startCamera = useCallback(
    async (quality: 'low' | 'medium' | 'high' = 'medium', targetRoom?: Room | null) => {
      const roomToUse = targetRoom ?? activeRoom;
      if (!roomToUse) {
        setCameraError('Keine aktive Voice-Verbindung für Video verfügbar.');
        return;
      }

      setIsPublishingCamera(true);
      setCameraError(null);

      try {
        const preset = qualityPresets[quality] || qualityPresets.medium;
        await roomToUse.localParticipant.setCameraEnabled(true, {
          deviceId: settings.devices.videoInputId ?? undefined,
          resolution: preset.resolution,
          frameRate: preset.frameRate,
        });
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
    [activeRoom, settings.devices.videoInputId, syncLocalMediaState]
  );

  const stopCamera = useCallback(async () => {
    if (!activeRoom) {
      setIsCameraEnabled(false);
      return;
    }

    setIsPublishingCamera(true);
    try {
      await activeRoom.localParticipant.setCameraEnabled(false);
      desiredMediaStateRef.current = { ...desiredMediaStateRef.current, cameraEnabled: false };
      syncLocalMediaState(activeRoom);
    } catch (err: any) {
      console.error('Kamera konnte nicht gestoppt werden', err);
      setCameraError(err?.message || 'Kamera konnte nicht gestoppt werden.');
    } finally {
      setIsPublishingCamera(false);
    }
  }, [activeRoom, syncLocalMediaState]);

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
        quality?: 'low' | 'medium' | 'high';
        frameRate?: number;
        track?: MediaStreamTrack;
        withAudio?: boolean;
        bitrateProfile?: 'low' | 'standard' | 'high';
      },
      targetRoom?: Room | null
    ) => {
      const roomToUse = targetRoom ?? activeRoom;
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
      const preferredFrameRate = options?.frameRate ?? preset.frameRate;
      const shouldShareAudio = options?.withAudio ?? shareSystemAudio;
      const bitrateProfile = options?.bitrateProfile ?? settings.talk.screenBitrateProfile ?? 'standard';
      const selectedBitrate = bitrateProfiles[bitrateProfile] ?? bitrateProfiles.standard;

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
        const filterHook = (window as any).ct?.filterSystemAudioTrack || (window as any).clover?.filterSystemAudioTrack;
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

      // FIX: Electron Detection & Handling
      if ((window as any).electron && (window as any).electron.getScreenSources) {
        try {
          const sourceId = options?.sourceId;

          if (!sourceId && !options?.track) {
            const sources = await (window as any).electron.getScreenSources();
            const fallbackId = sources[0]?.id;

            if (!fallbackId) {
              throw new Error('Keine Bildschirme gefunden.');
            }
            options = { ...options, sourceId: fallbackId };
          }

          let selectedTrack = options?.track;
          let systemAudioTrack: MediaStreamTrack | null = null;

          if (!selectedTrack || (shouldShareAudio && !systemAudioTrack)) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: shouldShareAudio
                ? ({
                    mandatory: {
                      chromeMediaSource: 'desktop',
                      ...(options?.sourceId ? { chromeMediaSourceId: options.sourceId } : {}),
                    },
                  } as MediaTrackConstraints)
                : false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  ...(options?.sourceId ? { chromeMediaSourceId: options.sourceId } : {}),
                  maxWidth: preset.resolution.width,
                  maxHeight: preset.resolution.height,
                  maxFrameRate: preferredFrameRate,
                },
              } as any,
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

          const publication = await roomToUse.localParticipant.publishTrack(selectedTrack, {
            name: 'screen_share',
            source: Track.Source.ScreenShare,
            videoEncoding: {
              maxBitrate: selectedBitrate.maxBitrate,
              maxFramerate: preferredFrameRate,
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

      // Standard Browser Fallback
      try {
        let stream: MediaStream | null = null;
        let videoTrack: MediaStreamTrack | null = null;
        let audioTrack: MediaStreamTrack | null = null;

        if (!shouldShareAudio && options?.track) {
          videoTrack = options.track;
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: preset.resolution.width,
              height: preset.resolution.height,
              frameRate: preferredFrameRate,
            },
            audio: shouldShareAudio
              ? ({
                  suppressLocalAudioPlayback: false,
                } as MediaTrackConstraints)
              : false,
          });

          const streamVideoTrack = stream.getVideoTracks()[0];
          videoTrack = options?.track ?? streamVideoTrack;
          audioTrack = shouldShareAudio ? stream.getAudioTracks()[0] ?? null : null;

          if (streamVideoTrack && videoTrack !== streamVideoTrack) {
            streamVideoTrack.stop();
          }
        }

        if (!videoTrack || videoTrack.readyState === 'ended') {
          throw new Error('Kein Videotrack für Screenshare gefunden.');
        }

        const publication = await roomToUse.localParticipant.publishTrack(videoTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare,
          videoEncoding: {
            maxBitrate: selectedBitrate.maxBitrate,
            maxFramerate: preferredFrameRate,
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
    [activeRoom, settings.talk.screenBitrateProfile, shareSystemAudio, syncLocalMediaState]
  );

  const stopScreenShare = useCallback(async () => {
    if (!activeRoom) {
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
            activeRoom.localParticipant.unpublishTrack(track, true);
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
        syncLocalMediaState(activeRoom);
      } else {
        await activeRoom.localParticipant.setScreenShareEnabled(false);
        desiredMediaStateRef.current = { ...desiredMediaStateRef.current, screenSharing: false };
        syncLocalMediaState(activeRoom);
      }
    } catch (err: any) {
      console.error('Screenshare konnte nicht gestoppt werden', err);
      setScreenShareError(err?.message || 'Screenshare konnte nicht gestoppt werden.');
    } finally {
      setIsPublishingScreen(false);
    }
  }, [activeRoom, syncLocalMediaState]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const disconnect = useCallback(async () => {
    console.warn('[voice] disconnect() called', new Error().stack);
    manualDisconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isConnecting.current = false;
    await stopRnnoisePipeline(activeRoom);
    if (activeRoom) {
      await activeRoom.disconnect();
    }
    setActiveRoom(null);
    setActiveChannelId(null);
    setActiveChannelName(null);
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
  }, [activeRoom]);

  const finalizeDisconnection = useCallback(
    (message: string | null) => {
      setConnectionState('disconnected');
      setActiveRoom(null);
      setActiveChannelId(null);
      setActiveChannelName(null);
      setToken(null);
      setError(message ?? null);
      syncLocalMediaState(null);
      isConnecting.current = false;
    },
    [syncLocalMediaState]
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
        await startCamera('medium', room);
      }

      if (desired.screenSharing && !room.localParticipant.isScreenShareEnabled) {
        await startScreenShare(undefined, room);
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

      if (activeRoom) {
        await stopRnnoisePipeline(activeRoom);
        await activeRoom.disconnect();
      }

      isConnecting.current = true;
      setConnectionState(options?.isReconnect ? 'reconnecting' : 'connecting');
      setError(null);

      try {
        const lkConfig = getLiveKitConfig(); // Config laden
        const roomName = `channel_${channelId}`;

        const res = await apiFetch<{ token: string }>(`/api/livekit/token?room=${roomName}`);
        const newToken = res.token;
        setToken(newToken);

        // Room Instanz mit den konfigurierten ICE-Servern erstellen
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: { simulcast: true },
        });

        room.on(RoomEvent.Disconnected, (reason) => {
          // CRITICAL FIX: Prevent Reconnect Loop on Duplicate Identity
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

          if (manualDisconnectRef.current) {
            finalizeDisconnection(null);
            return;
          }

          const channel = lastChannelRef.current;
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

        room.on(RoomEvent.Connected, async () => {
          setConnectionState('connected');
          setError(null);
          reconnectAttemptsRef.current = 0;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          isConnecting.current = false;
          syncLocalMediaState(room);
          await restoreMediaState(room);
        });

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.warn('[voice] ConnectionState', state);
        });

        room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
        room.on(RoomEvent.Reconnected, async () => {
          setConnectionState('connected');
          setError(null);
          reconnectAttemptsRef.current = 0;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          await restoreMediaState(room);
        });
        room.on(RoomEvent.Reconnecting, () => console.warn('[voice] Reconnecting'));
        room.on(RoomEvent.Reconnected, () => console.warn('[voice] Reconnected'));

        const handleTrackChange = () => syncLocalMediaState(room);
        room.on(RoomEvent.LocalTrackPublished, handleTrackChange);
        room.on(RoomEvent.LocalTrackUnpublished, handleTrackChange);
        room.on(RoomEvent.TrackMuted, handleTrackChange);
        room.on(RoomEvent.TrackUnmuted, handleTrackChange);

        // Verbinden mit der sicheren URL
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

        setActiveRoom(room);
        setActiveChannelId(channelId);
        setActiveChannelName(channelName);

      } catch (err: any) {
        console.error("Voice Connection Failed:", err);
        setError(err.message || 'Verbindung fehlgeschlagen');
        setConnectionState(options?.isReconnect ? 'reconnecting' : 'disconnected');
        syncLocalMediaState(null);
        setIsPublishingCamera(false);
        setIsPublishingScreen(false);
        isConnecting.current = false;
        if (options?.isReconnect) {
          lastDisconnectReasonRef.current = err?.message || null;
          throw err;
        }
      }
    },
    [
      activeChannelId,
      activeRoom,
      applyMicrophoneState,
      connectionState,
      finalizeDisconnection,
      stopRnnoisePipeline,
      settings.devices.audioInputId,
      settings.devices.audioOutputId,
      settings.devices.videoInputId,
      restoreMediaState,
    ]
  );

  useEffect(() => {
    if (!activeRoom) return;

    const applyPreferredDevices = async () => {
      try {
        if (settings.devices.audioInputId) {
          await activeRoom.switchActiveDevice('audioinput', settings.devices.audioInputId, true);
        }
        if (settings.devices.audioOutputId) {
          await activeRoom.switchActiveDevice('audiooutput', settings.devices.audioOutputId, true);
        }
        if (settings.devices.videoInputId) {
          await activeRoom.switchActiveDevice('videoinput', settings.devices.videoInputId, true);
        }
        await applyMicrophoneState(activeRoom);
      } catch (err) {
        console.warn('Could not apply preferred devices', err);
      }
    };

    applyPreferredDevices();
  }, [activeRoom, applyMicrophoneState, settings.devices.audioInputId, settings.devices.audioOutputId, settings.devices.videoInputId]);

  useEffect(() => {
    if (!activeRoom) {
      syncLocalMediaState(null);
      return;
    }

    syncLocalMediaState(activeRoom);
  }, [activeRoom, syncLocalMediaState]);

  return (
    <VoiceContext.Provider
      value={{
        activeRoom,
        activeChannelId,
        activeChannelName,
        connectionState,
        error,
        cameraError,
        screenShareError,
        connectToChannel,
        disconnect,
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
        screenShareAudioError,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};