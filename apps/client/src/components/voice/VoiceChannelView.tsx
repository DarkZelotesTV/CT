import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  AudioLines, 
  Camera, 
  ChevronUp, 
  Grid, 
  Headphones, 
  LayoutList, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  PhoneOff, 
  Settings2, 
  Video, 
  VideoOff, 
  XCircle 
} from 'lucide-react';
import { VoiceMediaStage } from './VoiceMediaStage';
import { useVoice } from '../../context/voice-state';
import { useSettings } from '../../context/SettingsContext';

// Discord-ähnliche Farbpalette und Design-Konstanten
const QUALITY_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: '360p',
  medium: '720p',
  high: '1080p',
};

const SCREEN_QUALITY_PRESETS: Record<'low' | 'medium' | 'high', { resolution: { width: number; height: number }; frameRate: number }> = {
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
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const isConnected = connectionState === 'connected';

  // --- Device & Stream Logic (Unverändert) ---
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

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const refreshScreenSources = useCallback(async () => {
    if (!(window as any).electron?.getScreenSources) return;
    try {
      const sources = await (window as any).electron.getScreenSources();
      setScreenSources(sources);
      if (!selectedScreenSource && sources.length) setSelectedScreenSource(sources[0].id);
    } catch (err: any) {
      setScreenPreviewError(err?.message || 'Screenshare-Quellen konnten nicht geladen werden.');
    }
  }, [selectedScreenSource]);

  useEffect(() => { if (isConnected) refreshScreenSources(); }, [isConnected, refreshScreenSources]);

  const stopScreenPreviewTrack = useCallback((stopTrack = true) => {
    setScreenPreviewTrack((prev) => {
      if (prev && stopTrack) prev.stop();
      return null;
    });
  }, []);

  useEffect(() => { return () => { stopScreenPreviewTrack(true); }; }, [stopScreenPreviewTrack]);
  useEffect(() => { if (!isScreenSharing) stopScreenPreviewTrack(true); }, [isScreenSharing, stopScreenPreviewTrack]);

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
    if (isCameraEnabled) await startCamera(next);
  };

  const handleStartScreenPreview = async () => {
    stopScreenPreviewTrack();
    setScreenPreviewError(null);
    const preset = SCREEN_QUALITY_PRESETS[screenQuality] ?? SCREEN_QUALITY_PRESETS.high;
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
        if (!track) throw new Error('Kein Videotrack gefunden.');
        setScreenPreviewTrack((prev) => { if (prev) prev.stop(); return track; });
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: preset.resolution.width, height: preset.resolution.height, frameRate: requestedFrameRate },
        audio: false,
      });
      stream.getAudioTracks().forEach((t) => t.stop());
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Kein Videotrack gefunden.');
      setScreenPreviewTrack((prev) => { if (prev) prev.stop(); return track; });
    } catch (err: any) {
      setScreenPreviewError(err?.message || 'Vorschau fehlgeschlagen.');
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
    if (screenPreviewTrack) setScreenPreviewTrack(null);
  };

  // --- Render ---

  // Status Indicator Farbe
  const statusColor = connectionState === 'connected' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-gray-100 relative overflow-hidden font-sans">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/5 shadow-lg flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
            <div>
                <div className="text-sm font-bold text-white leading-none">{channelName || 'Unbenannt'}</div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">
                    {connectionState === 'connected' ? 'Verbunden' : 'Verbinde...'}
                </div>
            </div>
        </div>

        {/* Layout Switcher (Top Right) */}
        <div className="pointer-events-auto bg-black/60 backdrop-blur-sm rounded-lg border border-white/5 p-1 flex gap-1">
            <button
              onClick={() => setLayout('grid')}
              className={`p-2 rounded hover:bg-white/10 transition-colors ${layout === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              title="Grid Layout"
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setLayout('speaker')}
              className={`p-2 rounded hover:bg-white/10 transition-colors ${layout === 'speaker' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
              title="Speaker Layout"
            >
              <LayoutList size={18} />
            </button>
        </div>
      </div>

      {/* Main Stage Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activeRoom ? (
          <VoiceMediaStage layout={layout} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 font-medium animate-pulse">
            Verbinde mit Voice Server...
          </div>
        )}
        
        {/* Error Toasts */}
        {(error || cameraError || screenShareError || deviceError || screenPreviewError) && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500/30 text-white px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2 max-w-lg z-50">
                <XCircle size={16} />
                <span className="truncate">{error || cameraError || screenShareError || deviceError || screenPreviewError}</span>
            </div>
        )}
      </div>

      {/* Bottom Control Dock (Discord Style) */}
      <div className="bg-[#1e1f22] flex-none flex flex-col items-center pb-6 pt-2 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        
        {/* Collapsible Device Settings */}
        <div className={`w-full max-w-4xl px-6 transition-all duration-300 overflow-hidden ${showDeviceSettings ? 'max-h-60 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
             <div className="bg-[#2b2d31] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Kamera</label>
                    <select
                        value={selectedVideo}
                        onChange={(e) => handleVideoDeviceChange(e.target.value)}
                        className="w-full bg-[#1e1f22] border border-black/20 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-200"
                    >
                         {videoDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                     <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Qualität</label>
                     <select
                        value={quality}
                        onChange={(e) => handleQualityChange(e.target.value as any)}
                        className="w-full bg-[#1e1f22] border border-black/20 rounded px-2 py-1.5 text-gray-200"
                    >
                        {Object.entries(QUALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                {/* Screen Share Settings could go here */}
                <div className="col-span-1 md:col-span-2 flex items-end justify-end">
                    <button 
                        onClick={() => setShowDeviceSettings(false)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                        Schließen
                    </button>
                </div>
             </div>
        </div>

        {/* Main Controls Row */}
        <div className="flex items-center justify-center gap-3 relative">
            
            {/* Toggle Settings */}
            <button 
                onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                className={`absolute -top-6 text-gray-500 hover:text-gray-300 transition-transform ${showDeviceSettings ? 'rotate-180' : ''}`}
            >
                <ChevronUp size={20} />
            </button>

            {/* Mic Toggle */}
            <div className="flex flex-col items-center gap-1 group">
                <button
                    onClick={() => setMicMuted(!micMuted)}
                    disabled={!isConnected}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                        micMuted 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-white text-gray-900 hover:bg-gray-200'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
                >
                    {micMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <span className="text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Mikrofon</span>
            </div>

            {/* Deafen Toggle */}
            <div className="flex flex-col items-center gap-1 group">
                <button
                    onClick={() => setMuted(!muted)}
                    disabled={!isConnected}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                        muted 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-[#2b2d31] text-gray-100 hover:bg-[#404249]'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
                >
                    {muted ? <Headphones size={24} className="opacity-50" /> : <Headphones size={24} />}
                </button>
                <span className="text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Audio</span>
            </div>

            {/* Camera Toggle */}
            <div className="flex flex-col items-center gap-1 group">
                <button
                    onClick={toggleCamera}
                    disabled={!isConnected || isPublishingCamera}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isCameraEnabled 
                        ? 'bg-white text-gray-900 hover:bg-gray-200' 
                        : 'bg-[#2b2d31] text-gray-100 hover:bg-[#404249]'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
                >
                    {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                </button>
                <span className="text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Kamera</span>
            </div>

            {/* Screen Share Toggle */}
            <div className="flex flex-col items-center gap-1 group">
                <button
                    onClick={handleStartScreenShare}
                    disabled={!isConnected || isPublishingScreen}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isScreenSharing 
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600' 
                        : 'bg-[#2b2d31] text-gray-100 hover:bg-[#404249]'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
                >
                    {isScreenSharing ? <Monitor size={24} /> : <MonitorOff size={24} />}
                </button>
                <span className="text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Stream</span>
            </div>

             {/* Disconnect Button Placeholder (Optional, falls Funktion vorhanden) */}
            <div className="flex flex-col items-center gap-1 group ml-2 border-l border-white/10 pl-4">
                 <button
                    onClick={() => {/* Implement disconnect if available in context */}}
                    className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
                    title="Verbindung trennen"
                >
                    <PhoneOff size={24} />
                </button>
            </div>

        </div>

        {/* Screen Preview (wenn aktiv) */}
        {screenPreviewTrack && !isScreenSharing && (
            <div className="fixed bottom-24 right-4 w-80 bg-[#2b2d31] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-in slide-in-from-bottom-5">
                <div className="bg-[#1e1f22] px-3 py-2 flex justify-between items-center border-b border-black/20">
                    <span className="text-xs font-bold text-indigo-400 uppercase">Stream Vorschau</span>
                    <button onClick={() => stopScreenPreviewTrack(true)} className="text-gray-400 hover:text-white"><XCircle size={14}/></button>
                </div>
                <div className="relative aspect-video bg-black">
                     <video ref={previewVideoRef} muted playsInline className="w-full h-full object-contain" />
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                         <button 
                            onClick={handleStartScreenShare}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg transform scale-100 hover:scale-105 transition-transform"
                        >
                            Live gehen
                         </button>
                     </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};