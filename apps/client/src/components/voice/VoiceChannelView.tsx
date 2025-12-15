import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
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
  XCircle,
  Check
} from 'lucide-react';
import { VoiceMediaStage } from './VoiceMediaStage';
import { useVoice } from '../../context/voice-state';
import { useSettings } from '../../context/SettingsContext';

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
  } = useVoice();
  const { settings, updateDevices } = useSettings();

  // Devices & Settings State
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState(settings.devices.videoInputId || '');
  const [selectedAudioInput, setSelectedAudioInput] = useState(settings.devices.audioInputId || '');
  
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [screenQuality, setScreenQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [screenFrameRate, setScreenFrameRate] = useState<number>(30);
  
  const [screenSources, setScreenSources] = useState<{ id: string; name: string; thumbnail?: string }[]>([]);
  const [selectedScreenSource, setSelectedScreenSource] = useState('');
  const [screenPreviewTrack, setScreenPreviewTrack] = useState<MediaStreamTrack | null>(null);
  const [screenPreviewError, setScreenPreviewError] = useState<string | null>(null);
  
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [activeMenu, setActiveMenu] = useState<'mic' | 'camera' | 'screen' | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isConnected = connectionState === 'connected';

  // --- Device Fetching ---
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch (err) {
      console.error("Fehler beim Laden der Geräte", err);
    }
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: 'mic' | 'camera' | 'screen') => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  // --- Handlers ---
  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideo(deviceId);
    updateDevices({ videoInputId: deviceId || null });
    if (isCameraEnabled) {
      await stopCamera();
      await startCamera(quality);
    }
    setActiveMenu(null);
  };

  const handleAudioInputChange = (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    updateDevices({ audioInputId: deviceId || null });
    // Audio restart logic handled often by SDK automatically on device change or requires context logic
    setActiveMenu(null);
  };

  const handleQualityChange = async (next: 'low' | 'medium' | 'high') => {
    setQuality(next);
    if (isCameraEnabled) await startCamera(next);
    setActiveMenu(null);
  };

  // ... (Screen Share Logic reused from previous, compacted for brevity) ...
  const refreshScreenSources = useCallback(async () => {
     if (!(window as any).electron?.getScreenSources) return;
     try {
       const sources = await (window as any).electron.getScreenSources();
       setScreenSources(sources);
       if (!selectedScreenSource && sources.length) setSelectedScreenSource(sources[0].id);
     } catch (err: any) { setScreenPreviewError(err?.message); }
   }, [selectedScreenSource]);
 
   useEffect(() => { if (isConnected && activeMenu === 'screen') refreshScreenSources(); }, [isConnected, activeMenu, refreshScreenSources]);

   const handleStartScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }
    // If electron, we might need a source selected first. 
    // For web simple version:
    await startScreenShare({
        sourceId: selectedScreenSource || undefined,
        quality: screenQuality,
        frameRate: screenFrameRate,
        withAudio: shareSystemAudio
    });
    setActiveMenu(null);
   };

  // --- Render Helpers ---

  const renderMenu = (content: React.ReactNode) => (
    <div 
        ref={menuRef}
        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl overflow-hidden z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
        <div className="max-h-80 overflow-y-auto custom-scrollbar py-2">
            {content}
        </div>
    </div>
  );

  const renderMenuItem = (label: string, onClick: () => void, isActive = false, subLabel?: string) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[#404249] transition-colors group"
    >
        <div className="flex flex-col items-start overflow-hidden">
            <span className={`text-sm truncate w-full ${isActive ? 'text-white font-medium' : 'text-gray-300 group-hover:text-gray-100'}`}>
                {label}
            </span>
            {subLabel && <span className="text-[10px] text-gray-500">{subLabel}</span>}
        </div>
        {isActive && <Check size={14} className="text-indigo-400 flex-none ml-2" />}
    </button>
  );

  const renderSectionHeader = (title: string) => (
    <div className="px-4 py-1.5 mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#232428]/50">
        {title}
    </div>
  );

  const statusColor = connectionState === 'connected' ? 'bg-emerald-500' : connectionState === 'connecting' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-gray-100 relative overflow-hidden font-sans select-none">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 shadow-lg flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
            <div>
                <div className="text-sm font-bold text-white leading-none tracking-tight">{channelName || 'Unbenannt'}</div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide opacity-80">
                    {connectionState === 'connected' ? 'Voice Connected' : 'Connecting...'}
                </div>
            </div>
        </div>
        <div className="pointer-events-auto bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-1 flex gap-1">
            <button onClick={() => setLayout('grid')} className={`p-2 rounded-lg transition-all ${layout === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-400 hover:text-gray-200'}`}>
              <Grid size={18} />
            </button>
            <button onClick={() => setLayout('speaker')} className={`p-2 rounded-lg transition-all ${layout === 'speaker' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-400 hover:text-gray-200'}`}>
              <LayoutList size={18} />
            </button>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activeRoom ? <VoiceMediaStage layout={layout} /> : <div className="flex-1 flex items-center justify-center text-gray-600 animate-pulse">Lade Voice Umgebung...</div>}
        
        {/* Error Toasts */}
        {(error || cameraError || screenShareError || screenPreviewError) && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/30 text-red-200 px-4 py-2 rounded-lg text-xs font-medium shadow-xl flex items-center gap-2 max-w-lg z-50 backdrop-blur-sm">
                <XCircle size={14} />
                <span className="truncate">{error || cameraError || screenShareError || screenPreviewError}</span>
            </div>
        )}
      </div>

      {/* Bottom Dock Control Bar */}
      <div className="bg-[#111214] flex-none flex justify-center items-center pb-6 pt-3 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] border-t border-white/5">
        <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-[#1e1f22] border border-[#2b2d31] shadow-2xl relative">
            
            {/* MICROPHONE */}
            <div className="relative group flex items-center bg-[#2b2d31] rounded-lg overflow-hidden border border-black/20 hover:border-gray-600 transition-colors">
                <button
                    onClick={() => setMicMuted(!micMuted)}
                    disabled={!isConnected}
                    className={`h-12 w-14 flex items-center justify-center transition-colors ${micMuted ? 'text-red-400 hover:bg-red-500/10' : 'text-white hover:bg-[#35373c]'}`}
                    title={micMuted ? 'Entstummen' : 'Stummschalten'}
                >
                    {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('mic')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 ${activeMenu === 'mic' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'mic' ? 'rotate-180' : ''}`} />
                </button>
                {activeMenu === 'mic' && renderMenu(
                    <>
                        {renderSectionHeader('Eingabegerät')}
                        {audioInputDevices.map(d => renderMenuItem(d.label || `Mikrofon ${d.deviceId.slice(0,4)}...`, () => handleAudioInputChange(d.deviceId), selectedAudioInput === d.deviceId))}
                        {/* Placeholder for noise suppression toggle etc. */}
                    </>
                )}
            </div>

            {/* AUDIO (DEAFEN) */}
            <button
                onClick={() => setMuted(!muted)}
                disabled={!isConnected}
                className={`h-12 w-14 rounded-lg flex items-center justify-center border border-black/20 transition-all ${
                    muted 
                    ? 'bg-[#2b2d31] text-red-400 border-red-500/30' 
                    : 'bg-[#2b2d31] text-gray-300 hover:bg-[#35373c] hover:text-white'
                }`}
                title={muted ? 'Audio aktivieren' : 'Stumm schalten (Deafen)'}
            >
                {muted ? <Headphones size={22} className="opacity-50" /> : <Headphones size={22} />}
            </button>

            {/* CAMERA */}
            <div className="relative group flex items-center bg-[#2b2d31] rounded-lg overflow-hidden border border-black/20 hover:border-gray-600 transition-colors">
                <button
                    onClick={toggleCamera}
                    disabled={!isConnected || isPublishingCamera}
                    className={`h-12 w-14 flex items-center justify-center transition-colors ${isCameraEnabled ? 'text-white bg-emerald-500/10' : 'text-gray-300 hover:bg-[#35373c]'}`}
                >
                    {isCameraEnabled ? <Video size={22} className="text-emerald-400" /> : <VideoOff size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('camera')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 ${activeMenu === 'camera' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'camera' ? 'rotate-180' : ''}`} />
                </button>
                {activeMenu === 'camera' && renderMenu(
                    <>
                        {renderSectionHeader('Kamera wählen')}
                        {videoDevices.map(d => renderMenuItem(d.label || 'Kamera', () => handleVideoDeviceChange(d.deviceId), selectedVideo === d.deviceId))}
                        
                        <div className="my-1 border-t border-white/5" />
                        {renderSectionHeader('Auflösung')}
                        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
                            renderMenuItem(label, () => handleQualityChange(key as any), quality === key)
                        ))}
                    </>
                )}
            </div>

            {/* SCREEN SHARE */}
            <div className="relative group flex items-center bg-[#2b2d31] rounded-lg overflow-hidden border border-black/20 hover:border-gray-600 transition-colors">
                <button
                    onClick={handleStartScreenShare}
                    disabled={!isConnected || isPublishingScreen}
                    className={`h-12 w-14 flex items-center justify-center transition-colors ${isScreenSharing ? 'text-white bg-indigo-500/20' : 'text-gray-300 hover:bg-[#35373c]'}`}
                >
                    {isScreenSharing ? <Monitor size={22} className="text-indigo-400" /> : <MonitorOff size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('screen')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 ${activeMenu === 'screen' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'screen' ? 'rotate-180' : ''}`} />
                </button>
                {activeMenu === 'screen' && renderMenu(
                    <>
                        {renderSectionHeader('Stream Qualität')}
                        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
                            renderMenuItem(`${label} @ ${screenFrameRate}fps`, () => setScreenQuality(key as any), screenQuality === key)
                        ))}
                        
                        <div className="my-1 border-t border-white/5" />
                        {renderSectionHeader('FPS')}
                        {[15, 30, 60].map(fps => (
                            renderMenuItem(`${fps} FPS`, () => setScreenFrameRate(fps), screenFrameRate === fps)
                        ))}

                        <div className="my-1 border-t border-white/5" />
                        {renderMenuItem(shareSystemAudio ? 'System-Audio: AN' : 'System-Audio: AUS', () => setShareSystemAudio(!shareSystemAudio), shareSystemAudio)}
                    </>
                )}
            </div>

            {/* DISCONNECT */}
            <div className="ml-2 pl-4 border-l border-white/10">
                 <button
                    className="h-12 w-14 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                    title="Verbindung trennen"
                >
                    <PhoneOff size={24} fill="currentColor" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};