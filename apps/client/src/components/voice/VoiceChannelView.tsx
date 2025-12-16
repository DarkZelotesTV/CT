import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  ChevronUp, 
  Grid, 
  Headphones, 
  LayoutList, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  PhoneOff, 
  Video, 
  VideoOff, 
  XCircle,
  Check,
  Laptop2,
  RefreshCw
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

const BITRATE_PROFILES: Record<'low' | 'standard' | 'high', { label: string; bitrateKbps: number; description: string }> = {
  low: { label: 'Niedrig', bitrateKbps: 800, description: 'Schonend für langsame Verbindungen' },
  standard: { label: 'Standard', bitrateKbps: 1800, description: 'Gutes Gleichgewicht aus Qualität und Bandbreite' },
  high: { label: 'Hoch', bitrateKbps: 3500, description: 'Maximale Details bei höheren Bitraten' },
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
    disconnect, // <--- WICHTIG: Importieren der zentralen Disconnect-Funktion
  } = useVoice();
  const { settings, updateDevices, updateTalk } = useSettings();

  // --- State ---
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState(settings.devices.videoInputId || '');
  const [selectedAudioInput, setSelectedAudioInput] = useState(settings.devices.audioInputId || '');
  
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>(settings.talk.cameraQuality ?? 'medium');
  const [screenQuality, setScreenQuality] = useState<'low' | 'medium' | 'high'>(settings.talk.screenQuality ?? 'high');
  const [screenFrameRate, setScreenFrameRate] = useState<number>(settings.talk.screenFrameRate ?? 30);
  const [screenBitrateProfile, setScreenBitrateProfile] = useState<'low' | 'standard' | 'high'>(
    settings.talk.screenBitrateProfile ?? 'standard'
  );
  
  const [screenSources, setScreenSources] = useState<{ id: string; name: string; thumbnail?: string }[]>([]);
  const [selectedScreenSource, setSelectedScreenSource] = useState('');
  
  const [screenPreviewTrack, setScreenPreviewTrack] = useState<MediaStreamTrack | null>(null);
  const [screenPreviewError, setScreenPreviewError] = useState<string | null>(null);

  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [floatingScreenShare, setFloatingScreenShare] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'mic' | 'camera' | 'screen' | null>(null);

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

  useEffect(() => {
    setQuality(settings.talk.cameraQuality ?? 'medium');
    setScreenQuality(settings.talk.screenQuality ?? 'high');
    setScreenFrameRate(settings.talk.screenFrameRate ?? 30);
    setScreenBitrateProfile(settings.talk.screenBitrateProfile ?? 'standard');
  }, [settings.talk.cameraQuality, settings.talk.screenBitrateProfile, settings.talk.screenFrameRate, settings.talk.screenQuality]);

  useEffect(() => {
    updateTalk({ cameraQuality: quality });
  }, [quality, updateTalk]);

  useEffect(() => {
    updateTalk({ screenQuality });
  }, [screenQuality, updateTalk]);

  useEffect(() => {
    updateTalk({ screenFrameRate });
  }, [screenFrameRate, updateTalk]);

  useEffect(() => {
    updateTalk({ screenBitrateProfile });
  }, [screenBitrateProfile, updateTalk]);

  // Screen Sources (Electron)
  const refreshScreenSources = useCallback(async () => {
     if (!(window as any).electron?.getScreenSources) return;
     try {
       const sources = await (window as any).electron.getScreenSources();
       setScreenSources(sources);
       if (!selectedScreenSource && sources.length) {
         setSelectedScreenSource(sources[0].id);
       }
     } catch (err: any) { 
        setScreenPreviewError(err?.message); 
     }
   }, [selectedScreenSource]);
 
   useEffect(() => { 
       if (isConnected && activeMenu === 'screen') {
           refreshScreenSources();
       }
   }, [isConnected, activeMenu, refreshScreenSources]);

  // Click Outside
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
    setActiveMenu(prev => (prev === menu ? null : menu));
  };

  // --- Handlers ---
  
  // KORREKTUR: Wir nutzen nun disconnect() aus dem Context, 
  // welches `manualDisconnectRef` setzt und den Reconnect verhindert.
  const handleDisconnect = async () => {
    console.log("Manuelles Trennen der Verbindung...");
    await disconnect();
  };

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
    setActiveMenu(null);
  };

  const handleQualityChange = async (next: 'low' | 'medium' | 'high') => {
    setQuality(next);
    if (isCameraEnabled) await startCamera(next);
  };

   const handleStartScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }
    await startScreenShare({
        sourceId: selectedScreenSource || undefined,
        quality: screenQuality,
        frameRate: screenFrameRate,
        withAudio: shareSystemAudio,
        bitrateProfile: screenBitrateProfile,
    });
    setActiveMenu(null);
   };

  // --- Render Helpers ---

  const renderMenu = (content: React.ReactNode, width = "w-64") => (
    <div 
        ref={menuRef}
        className={`absolute bottom-[115%] left-1/2 -translate-x-1/2 ${width} bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-200`}
        onMouseDown={(e) => e.stopPropagation()} 
    >
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar py-2">
            {content}
        </div>
    </div>
  );

  const renderMenuItem = (label: string, onClick: () => void, isActive = false, subLabel?: string, icon?: React.ReactNode) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[#404249] transition-colors group text-left"
    >
        <div className="flex items-center gap-3 overflow-hidden">
            {icon && <span className="text-gray-400 group-hover:text-gray-200">{icon}</span>}
            <div className="flex flex-col items-start overflow-hidden">
                <span className={`text-sm truncate w-full ${isActive ? 'text-white font-medium' : 'text-gray-300 group-hover:text-gray-100'}`}>
                    {label}
                </span>
                {subLabel && <span className="text-[10px] text-gray-500 truncate max-w-[180px]">{subLabel}</span>}
            </div>
        </div>
        {isActive && <Check size={14} className="text-indigo-400 flex-none ml-2" />}
    </button>
  );

  const renderSectionHeader = (title: string) => (
    <div className="px-4 py-1.5 mt-2 mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        {title}
    </div>
  );

  const renderSeparator = () => <div className="my-1 border-t border-white/5" />;

  const statusColor = connectionState === 'connected' ? 'bg-emerald-500' : connectionState === 'connecting' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-gray-100 relative overflow-hidden font-sans select-none">
      
      {/* Header Info */}
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
        {activeRoom ? (
          <VoiceMediaStage
            layout={layout}
            floatingScreenShare={floatingScreenShare}
            onRequestAnchor={() => setFloatingScreenShare(false)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 animate-pulse">Lade Voice Umgebung...</div>
        )}
        
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
            <div className="relative group flex items-center bg-[#2b2d31] border border-black/20 hover:border-gray-600 transition-colors rounded-lg">
                <button
                    onClick={() => setMicMuted(!micMuted)}
                    disabled={!isConnected}
                    className={`h-12 w-14 flex items-center justify-center transition-colors rounded-l-lg ${micMuted ? 'text-red-400 hover:bg-red-500/10' : 'text-white hover:bg-[#35373c]'}`}
                    title={micMuted ? 'Entstummen' : 'Stummschalten'}
                >
                    {micMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('mic')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 rounded-r-lg ${activeMenu === 'mic' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'mic' ? 'rotate-180' : ''}`} />
                </button>
                
                {activeMenu === 'mic' && renderMenu(
                    <>
                        {renderSectionHeader('Eingabegerät')}
                        {audioInputDevices.length === 0 && (
                            <div className="px-4 py-2 text-xs text-gray-500 italic">Keine Mikrofone gefunden</div>
                        )}
                        {audioInputDevices.map(d => renderMenuItem(
                            d.label || `Mikrofon ${d.deviceId.slice(0,4)}...`, 
                            () => handleAudioInputChange(d.deviceId), 
                            selectedAudioInput === d.deviceId
                        ))}
                        {renderSeparator()}
                        <div className="px-4 py-2 text-[10px] text-gray-500 text-center">
                            Weitere Einstellungen in den User-Settings
                        </div>
                    </>
                )}
            </div>

            {/* DEAFEN */}
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
            <div className="relative group flex items-center bg-[#2b2d31] border border-black/20 hover:border-gray-600 transition-colors rounded-lg">
                <button
                    onClick={toggleCamera}
                    disabled={!isConnected || isPublishingCamera}
                    className={`h-12 w-14 flex items-center justify-center transition-colors rounded-l-lg ${isCameraEnabled ? 'text-white bg-emerald-500/10' : 'text-gray-300 hover:bg-[#35373c]'}`}
                >
                    {isCameraEnabled ? <Video size={22} className="text-emerald-400" /> : <VideoOff size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('camera')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 rounded-r-lg ${activeMenu === 'camera' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'camera' ? 'rotate-180' : ''}`} />
                </button>

                {activeMenu === 'camera' && renderMenu(
                    <>
                        {renderSectionHeader('Kamera wählen')}
                        {videoDevices.map(d => renderMenuItem(
                            d.label || 'Kamera', 
                            () => handleVideoDeviceChange(d.deviceId), 
                            selectedVideo === d.deviceId
                        ))}
                        {renderSeparator()}
                        {renderSectionHeader('Auflösung')}
                        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
                            renderMenuItem(label, () => handleQualityChange(key as any), quality === key)
                        ))}
                    </>
                )}
            </div>

            {/* SCREEN SHARE */}
            <div className="relative group flex items-center bg-[#2b2d31] border border-black/20 hover:border-gray-600 transition-colors rounded-lg">
                <button
                    onClick={handleStartScreenShare}
                    disabled={!isConnected || isPublishingScreen}
                    className={`h-12 w-14 flex items-center justify-center transition-colors rounded-l-lg ${isScreenSharing ? 'text-white bg-indigo-500/20' : 'text-gray-300 hover:bg-[#35373c]'}`}
                    title="Bildschirm übertragen"
                >
                    {isScreenSharing ? <Monitor size={22} className="text-indigo-400" /> : <MonitorOff size={22} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10" />
                <button 
                    onClick={() => toggleMenu('screen')} 
                    className={`h-12 w-8 flex items-center justify-center hover:bg-[#35373c] text-gray-400 rounded-r-lg ${activeMenu === 'screen' ? 'bg-[#35373c] text-white' : ''}`}
                >
                    <ChevronUp size={14} className={`transition-transform duration-200 ${activeMenu === 'screen' ? 'rotate-180' : ''}`} />
                </button>

                {activeMenu === 'screen' && renderMenu(
                    <>  
                        {renderSectionHeader('Quelle (Anwendung / Screen)')}
                        {screenSources.length > 0 ? (
                            screenSources.map((s) => (
                                renderMenuItem(
                                    s.name, 
                                    () => setSelectedScreenSource(s.id), 
                                    selectedScreenSource === s.id,
                                    undefined,
                                    s.thumbnail ? <img src={s.thumbnail} className="w-4 h-4 rounded" alt="" /> : <Laptop2 size={14}/>
                                )
                            ))
                        ) : (
                             <div className="px-4 py-2 text-xs text-gray-400 flex items-center gap-2">
                                <RefreshCw size={12} className={activeMenu === 'screen' ? 'animate-spin' : ''}/>
                                <span>Auswahl im Browser-Dialog...</span>
                             </div>
                        )}
                        {renderSeparator()}
                        {renderSectionHeader('Übertragungsqualität')}
                        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
                            renderMenuItem(
                                label,
                                () => setScreenQuality(key as any),
                                screenQuality === key,
                                `${SCREEN_QUALITY_PRESETS[key as 'low'|'medium'|'high'].resolution.height}p`
                            )
                        ))}
                        {renderSeparator()}
                        {renderSectionHeader('Bitrate-Profil')}
                        {Object.entries(BITRATE_PROFILES).map(([key, profile]) => (
                            renderMenuItem(
                                profile.label,
                                () => setScreenBitrateProfile(key as 'low' | 'standard' | 'high'),
                                screenBitrateProfile === key,
                                `${profile.bitrateKbps} kbps · ${profile.description}`
                            )
                        ))}
                        {renderSeparator()}
                        {renderSectionHeader('Bildrate')}
                        {[15, 30, 60].map(fps => (
                            renderMenuItem(`${fps} FPS`, () => setScreenFrameRate(fps), screenFrameRate === fps)
                        ))}
                        {renderSeparator()}
                        {renderMenuItem(
                            shareSystemAudio ? 'System-Audio übertragen' : 'Kein System-Audio',
                            () => setShareSystemAudio(!shareSystemAudio),
                            shareSystemAudio
                        )}
                        {renderSeparator()}
                        {renderMenuItem(
                            floatingScreenShare ? 'PiP / Floating aktiviert' : 'Standard-Layout',
                            () => setFloatingScreenShare((prev) => !prev),
                            floatingScreenShare,
                            floatingScreenShare ? 'Screen-Share als bewegliches Overlay anzeigen' : 'Screen-Share im Layout verankern'
                        )}
                        {!isScreenSharing && (
                            <div className="p-2 mt-1 sticky bottom-0 bg-[#2b2d31] border-t border-white/5">
                                <button
                                    onClick={() => { handleStartScreenShare(); setActiveMenu(null); }}
                                    className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-bold uppercase tracking-wide transition-colors"
                                >
                                    Live gehen
                                </button>
                            </div>
                        )}
                    </>,
                    "w-72"
                )}
            </div>

            {/* DISCONNECT BUTTON */}
            <div className="ml-2 pl-4 border-l border-white/10">
                 <button
                    onClick={handleDisconnect}
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
