import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { getLiveKitConfig } from '../utils/apiConfig';
import { VoiceContext, VoiceContextType } from './voice-state';
import { apiFetch } from '../api/http';
import { useSettings } from './SettingsContext';

const qualityPresets = {
  low: { resolution: { width: 640, height: 360 }, frameRate: 24 },
  medium: { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  high: { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
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

  const publishedScreenTracksRef = useRef<MediaStreamTrack[]>([]);

  const isConnecting = useRef(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    setMutedState(settings.talk.muted);
    setMicMutedState(settings.talk.micMuted);
    setUsePushToTalkState(settings.talk.pushToTalkEnabled);
  }, [settings.talk.micMuted, settings.talk.muted, settings.talk.pushToTalkEnabled]);

  const syncLocalMediaState = useCallback((room: Room | null) => {
    if (!room) {
      setIsCameraEnabled(false);
      setIsScreenSharing(false);
      setLocalParticipantId(null);
      return;
    }

    const local = room.localParticipant;
    setIsCameraEnabled(!!local?.isCameraEnabled);
    setIsScreenSharing(!!local?.isScreenShareEnabled);
    setLocalParticipantId(local?.sid || local?.identity || null);
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
      if (room) {
        await room.localParticipant.setMicrophoneEnabled(shouldEnable);
      }
    },
    [isTalking, micMuted, muted, usePushToTalk]
  );

  const setMuted = useCallback(
    async (nextMuted: boolean) => {
      setMutedState(nextMuted);
      updateTalk({ muted: nextMuted });
      if (nextMuted) setIsTalking(false);
      if (activeRoom) await applyMicrophoneState(activeRoom, { muted: nextMuted, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const setMicMuted = useCallback(
    async (nextMuted: boolean) => {
      setMicMutedState(nextMuted);
      updateTalk({ micMuted: nextMuted });
      if (nextMuted) setIsTalking(false);
      if (activeRoom) await applyMicrophoneState(activeRoom, { micMuted: nextMuted, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const setPushToTalk = useCallback(
    async (enabled: boolean) => {
      setUsePushToTalkState(enabled);
      updateTalk({ pushToTalkEnabled: enabled });
      if (!enabled) setIsTalking(false);
      if (activeRoom) await applyMicrophoneState(activeRoom, { pushToTalk: enabled, talking: false });
    },
    [activeRoom, applyMicrophoneState, updateTalk]
  );

  const startTalking = useCallback(async () => {
    setIsTalking(true);
    if (activeRoom) await applyMicrophoneState(activeRoom, { talking: true });
  }, [activeRoom, applyMicrophoneState]);

  const stopTalking = useCallback(async () => {
    setIsTalking(false);
    if (activeRoom) await applyMicrophoneState(activeRoom, { talking: false });
  }, [activeRoom, applyMicrophoneState]);

  const startCamera = useCallback(
    async (quality: 'low' | 'medium' | 'high' = 'medium') => {
      if (!activeRoom) {
        setCameraError('Keine aktive Voice-Verbindung für Video verfügbar.');
        return;
      }

      setIsPublishingCamera(true);
      setCameraError(null);

      try {
        const preset = qualityPresets[quality] || qualityPresets.medium;
        await activeRoom.localParticipant.setCameraEnabled(true, {
          deviceId: settings.devices.videoInputId ?? undefined,
          resolution: preset.resolution,
          frameRate: preset.frameRate,
        });
        syncLocalMediaState(activeRoom);
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
    async (options?: {
      sourceId?: string;
      quality?: 'low' | 'medium' | 'high';
      frameRate?: number;
      track?: MediaStreamTrack;
      withAudio?: boolean;
    }) => {
      if (!activeRoom) {
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

          await activeRoom.localParticipant.publishTrack(selectedTrack, {
            name: 'screen_share',
            source: Track.Source.ScreenShare,
          });

          if (shouldShareAudio) {
            const filteredAudioTrack = applySystemAudioFilter(systemAudioTrack);
            if (filteredAudioTrack && filteredAudioTrack.readyState !== 'ended') {
              await activeRoom.localParticipant.publishTrack(filteredAudioTrack, {
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

          syncLocalMediaState(activeRoom);
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
        const stream = await navigator.mediaDevices.getDisplayMedia({
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
        const videoTrack = options?.track ?? streamVideoTrack;
        const audioTrack = shouldShareAudio ? stream.getAudioTracks()[0] ?? null : null;

        if (streamVideoTrack && videoTrack !== streamVideoTrack) {
          streamVideoTrack.stop();
        }

        if (!videoTrack || videoTrack.readyState === 'ended') {
          throw new Error('Kein Videotrack für Screenshare gefunden.');
        }

        await activeRoom.localParticipant.publishTrack(videoTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare,
        });

        if (shouldShareAudio) {
          const filteredAudioTrack = applySystemAudioFilter(audioTrack);
          if (filteredAudioTrack && filteredAudioTrack.readyState !== 'ended') {
            await activeRoom.localParticipant.publishTrack(filteredAudioTrack, {
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

        syncLocalMediaState(activeRoom);
      } catch (err: any) {
        console.error('Screenshare konnte nicht gestartet werden', err);
        setScreenShareError(err?.message || 'Screenshare konnte nicht gestartet werden.');
        setIsScreenSharing(false);
      } finally {
        setIsPublishingScreen(false);
      }
    },
    [activeRoom, shareSystemAudio, syncLocalMediaState]
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
        syncLocalMediaState(activeRoom);
      } else {
        await activeRoom.localParticipant.setScreenShareEnabled(false);
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
    isConnecting.current = false;
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

  const connectToChannel = useCallback(async (channelId: number, channelName: string) => {
    const attempt = ++attemptRef.current;
    if (activeChannelId === channelId && connectionState === 'connected') return;
    if (isConnecting.current) return;

    if (activeRoom) {
      await activeRoom.disconnect();
    }

    isConnecting.current = true;
    setConnectionState('connecting');
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
        console.warn('[voice] Room disconnected', reason);
        setConnectionState('disconnected');
        setActiveRoom(null);
        setActiveChannelId(null);
        setActiveChannelName(null);
        syncLocalMediaState(null);
        isConnecting.current = false;
      });

      room.on(RoomEvent.Connected, () => {
        setConnectionState('connected');
        isConnecting.current = false;
        syncLocalMediaState(room);
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.warn('[voice] ConnectionState', state);
      });

      room.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => setConnectionState('connected'));
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
      setConnectionState('disconnected');
      syncLocalMediaState(null);
      setIsPublishingCamera(false);
      setIsPublishingScreen(false);
      isConnecting.current = false;
    }
  }, [activeChannelId, activeRoom, applyMicrophoneState, connectionState, settings.devices.audioInputId, settings.devices.audioOutputId, settings.devices.videoInputId]);

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
        setMuted,
        setMicMuted,
        setPushToTalk,
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