import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Grid, Headphones, LayoutList, MicOff, ScreenShare, Settings2, Video, XCircle } from 'lucide-react';
import { VoiceMediaStage } from './VoiceMediaStage';
import { useVoice } from '../../context/voice-state';
import { useSettings } from '../../context/SettingsContext';

const qualityLabels: Record<'low' | 'medium' | 'high', string> = {
  low: '360p',
  medium: '720p',
  high: '1080p',
};

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
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
    startCamera,
    stopCamera,
    toggleScreenShare,
    toggleCamera,
  } = useVoice();
  const { settings, updateDevices } = useSettings();

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState(settings.devices.videoInputId || '');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [deviceError, setDeviceError] = useState<string | null>(null);

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

      <VoiceMediaStage layout={layout} />

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
            onClick={toggleScreenShare}
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

        {(cameraError || screenShareError || deviceError) && (
          <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            {cameraError || screenShareError || deviceError}
          </div>
        )}
      </div>
    </div>
  );
};
