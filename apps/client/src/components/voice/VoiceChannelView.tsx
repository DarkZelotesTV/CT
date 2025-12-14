import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Camera, Grid, Headphones, LayoutList, MicOff, Play, ScreenShare, Settings2, Video, XCircle } from 'lucide-react';
// NOTE:
// We intentionally do NOT use <LiveKitRoom> here.
// The app already connects/disconnects the Room inside VoiceProvider and exposes it via RoomContext
// (see MainLayout).
//
// Rendering <LiveKitRoom connect={false}> will actively disconnect the room (LiveKitRoom treats
// the `connect` prop as the desired connection state). That creates an immediate disconnect/reconnect loop.
// RoomAudioRenderer is rendered globally in MainLayout when a room exists.
import { VoiceMediaStage } from './VoiceMediaStage';
import { useVoice } from '../../context/voice-state';
import { useSettings } from '../../context/SettingsContext';

const qualityLabels: Record<'low' | 'medium' | 'high', string> = {
  low: '360p',
  medium: '720p',
  high: '1080p',
};

const screenQualityPresets: Record<'low' | 'medium' | 'high', { resolution: { width: number; height: number }; frameRate: number }> = {
  low: { resolution: { width: 640, height: 360 }, frameRate: 24 },
  medium: { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  high: { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
};

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
    activeRoom,
    connectionState,
    error,
    cameraError,
    screenShareError,
    muted,
    micMuted,
    setMuted,
    setMicMuted,
    isCameraEnabled,
    isScreenSharing,
    isPublishingCamera,
    isPublishingScreen,
    shareSystemAudio,
    setShareSystemAudio,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleCamera,
    screenShareAudioError,
  } = useVoice();
  const { settings, updateDevices } = useSettings();
  // serverUrl/token are managed by VoiceProvider. We only need the active Room from context.

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState(settings.devices.videoInputId || '');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [screenQuality, setScreenQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [screenFrameRate, setScreenFrameRate] = useState<number>(30);
  const [screenSources, setScreenSources] = useState<{ id: string; name: string; thumbnail?: string }[]>([]);
  const [selectedScreenSource, setSelectedScreenSource] = useState('');
  const [screenPreviewTrack, setScreenPreviewTrack] = useState<MediaStreamTrack | null>(null);
  const [screenPreviewError, setScreenPreviewError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const isConnected = connectionState === 'connected';

  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setDeviceError(null);
    } catch (err: any) {
      setDeviceError(err?.message || 'Geräte konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const refreshScreenSources = useCallback(async () => {
    if (!(window as any).electron?.getScreenSources) return;
    try {
      const sources = await (window as any).electron.getScreenSources();
      setScreenSources(sources);
      if (!selectedScreenSource && sources.length) {
        setSelectedScreenSource(sources[0].id);
      }
    } catch (err: any) {
      setScreenPreviewError(err?.message || 'Screenshare-Quellen konnten nicht geladen werden.');
    }
  }, [selectedScreenSource]);

  useEffect(() => {
    if (isConnected) {
      refreshScreenSources();
    }
  }, [isConnected, refreshScreenSources]);

  const stopScreenPreviewTrack = useCallback(
    (stopTrack = true) => {
      setScreenPreviewTrack((prev) => {
        if (prev && stopTrack) {
          prev.stop();
        }
        return null;
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      stopScreenPreviewTrack(true);
    };
  }, [stopScreenPreviewTrack]);

  useEffect(() => {
    if (!isScreenSharing) {
      stopScreenPreviewTrack(true);
    }
  }, [isScreenSharing, stopScreenPreviewTrack]);

  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideo(deviceId);
    updateDevices({ videoInputId: deviceId || null });
    if (isCameraEnabled) {
      await stopCamera();
      await startCamera(quality);
    }
  };

  const handleQualityChange = async (next: 'low' | 'medium' | 'high') => {
    setQuality(next);
    if (isCameraEnabled) {
      await startCamera(next);
    }
  };

  const handleStartScreenPreview = async () => {
    stopScreenPreviewTrack();
    setScreenPreviewError(null);
    const preset = screenQualityPresets[screenQuality] ?? screenQualityPresets.high;
    const requestedFrameRate = screenFrameRate || preset.frameRate;

    try {
      if ((window as any).electron?.getScreenSources) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              ...(selectedScreenSource ? { chromeMediaSourceId: selectedScreenSource } : {}),
              maxWidth: preset.resolution.width,
              maxHeight: preset.resolution.height,
              maxFrameRate: requestedFrameRate,
            },
          } as any,
        });
        stream.getAudioTracks().forEach((t) => t.stop());
        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error('Kein Videotrack für die Vorschau gefunden.');
        setScreenPreviewTrack((prev) => {
          if (prev) prev.stop();
          return track;
        });
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: preset.resolution.width,
          height: preset.resolution.height,
          frameRate: requestedFrameRate,
        },
        audio: false,
      });
      stream.getAudioTracks().forEach((t) => t.stop());
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Kein Videotrack für die Vorschau gefunden.');
      setScreenPreviewTrack((prev) => {
        if (prev) prev.stop();
        return track;
      });
    } catch (err: any) {
      setScreenPreviewError(err?.message || 'Vorschau konnte nicht gestartet werden.');
      stopScreenPreviewTrack();
    }
  };

  useEffect(() => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;
    if (screenPreviewTrack) {
      const stream = new MediaStream([screenPreviewTrack]);
      videoEl.srcObject = stream;
      videoEl.play().catch(() => undefined);
    } else {
      videoEl.srcObject = null;
    }
  }, [screenPreviewTrack]);

  const handleStartScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenPreviewTrack(true);
      await stopScreenShare();
      return;
    }

    await startScreenShare({
      sourceId: selectedScreenSource || undefined,
      quality: screenQuality,
      frameRate: screenFrameRate,
      track: screenPreviewTrack || undefined,
      withAudio: shareSystemAudio,
    });

    if (screenPreviewTrack) {
      setScreenPreviewTrack(null);
    }
  };

  const statusPill = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return { label: 'Verbunden', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
      case 'connecting':
        return { label: 'Verbindet...', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
      case 'reconnecting':
        return { label: 'Stellt wieder her...', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
      default:
        return { label: 'Getrennt', className: 'bg-gray-800 text-gray-400 border-white/5' };
    }
  }, [connectionState]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07080d]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/30">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusPill.className}`}>
            {statusPill.label}
          </div>
          <div className="text-sm text-gray-300 font-semibold">{channelName || 'Voice Channel'}</div>
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <XCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Settings2 size={14} />
          LiveKit Session
        </div>
      </div>

      {activeRoom ? (
        <>
          <VoiceMediaStage layout={layout} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Verbinde Voice...</div>
      )}

      <div className="border-t border-white/5 bg-black/40 px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setMicMuted(!micMuted)}
            disabled={!isConnected}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              micMuted
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MicOff size={16} />
            {micMuted ? 'Mic aus' : 'Mic an'}
          </button>
          <button
            onClick={() => setMuted(!muted)}
            disabled={!isConnected}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              muted
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Headphones size={16} />
            {muted ? 'Stumm' : 'Audio an'}
          </button>
          <button
            onClick={toggleCamera}
            disabled={!isConnected || isPublishingCamera}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              isCameraEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Camera size={16} />
            {isPublishingCamera ? 'Startet...' : isCameraEnabled ? 'Kamera an' : 'Kamera starten'}
          </button>
          <button
            onClick={handleStartScreenShare}
            disabled={!isConnected || isPublishingScreen}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              isScreenSharing
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ScreenShare size={16} />
            {isPublishingScreen ? 'Teilen...' : isScreenSharing ? 'Screen aktiv' : 'Screen teilen'}
          </button>
          <button
            onClick={() => setShareSystemAudio(!shareSystemAudio)}
            disabled={!isConnected || isPublishingScreen}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              shareSystemAudio
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <AudioLines size={16} />
            {shareSystemAudio ? 'Systemaudio an' : 'Systemaudio aus'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-gray-400" />
            <select
              value={selectedVideo}
              onChange={(e) => handleVideoDeviceChange(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs min-w-[180px]"
              disabled={!isConnected}
            >
              <option value="">Standard Kamera</option>
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Kamera'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-gray-400" />
            <select
              value={quality}
              onChange={(e) => handleQualityChange(e.target.value as 'low' | 'medium' | 'high')}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs"
              disabled={!isConnected}
            >
              {(['low', 'medium', 'high'] as const).map((q) => (
                <option key={q} value={q}>
                  {qualityLabels[q]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ScreenShare size={16} className="text-gray-400" />
            <select
              value={selectedScreenSource}
              onChange={(e) => setSelectedScreenSource(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs min-w-[200px]"
              disabled={!isConnected || (!!screenSources.length && isPublishingScreen)}
            >
              <option value="">Quelle im Freigabe-Dialog wählen</option>
              {screenSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-gray-400" />
            <select
              value={screenQuality}
              onChange={(e) => setScreenQuality(e.target.value as 'low' | 'medium' | 'high')}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs"
              disabled={!isConnected}
            >
              {(['low', 'medium', 'high'] as const).map((q) => (
                <option key={q} value={q}>
                  Bildschirm {qualityLabels[q]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-gray-400" />
            <select
              value={screenFrameRate}
              onChange={(e) => setScreenFrameRate(Number(e.target.value))}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs"
              disabled={!isConnected}
            >
              {[24, 30, 60].map((fps) => (
                <option key={fps} value={fps}>
                  {fps} FPS
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleStartScreenPreview}
            disabled={!isConnected || isPublishingScreen || isScreenSharing}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${
              screenPreviewTrack
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100'
                : 'bg-white/5 border-white/10 text-white hover:border-white/20'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play size={16} />
            {screenPreviewTrack ? 'Vorschau aktiv' : 'Vorschau starten'}
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs uppercase text-gray-500">Layout</span>
            <button
              onClick={() => setLayout('grid')}
              className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                layout === 'grid'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-black/40 border-white/10 text-gray-300'
              }`}
            >
              <Grid size={14} /> Grid
            </button>
            <button
              onClick={() => setLayout('speaker')}
              className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                layout === 'speaker'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-black/40 border-white/10 text-gray-300'
              }`}
            >
              <LayoutList size={14} /> Speaker
            </button>
          </div>
        </div>

        {screenPreviewTrack && !isScreenSharing && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span>Vorschau der Bildschirmfreigabe (noch nicht live)</span>
              <button
                onClick={() => stopScreenPreviewTrack(true)}
                className="px-2 py-1 text-[11px] font-semibold border border-white/10 rounded-md hover:border-white/30"
              >
                Vorschau schließen
              </button>
            </div>
            <div className="relative w-full overflow-hidden rounded-md border border-white/10 bg-black/60">
              <video ref={previewVideoRef} muted playsInline className="w-full h-52 object-contain bg-black" />
              <div className="absolute bottom-2 left-2 right-2 text-[11px] text-gray-300 bg-black/60 px-2 py-1 rounded">
                Quelle: {selectedScreenSource ? 'Desktop-Quelle ausgewählt' : 'Auswahl erfolgt im Browser-Freigabe-Dialog'} |{' '}
                Auflösung: {qualityLabels[screenQuality]} | {screenFrameRate} FPS
              </div>
            </div>
          </div>
        )}

        {(cameraError || screenShareError || deviceError || screenPreviewError || screenShareAudioError) && (
          <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            {cameraError || screenShareError || deviceError || screenPreviewError || screenShareAudioError}
          </div>
        )}
      </div>
    </div>
  );
};
