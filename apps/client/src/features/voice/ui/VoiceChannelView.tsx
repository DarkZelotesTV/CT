import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  ChevronUp, Grid, Headphones, LayoutList, Mic, MicOff, 
  Monitor, MonitorOff, PhoneOff, Video, VideoOff, 
  XCircle, Check, Laptop2, RefreshCw, Settings, Sliders, Volume2
} from 'lucide-react';
import { VoiceMediaStage } from './VoiceMediaStage';
import { useVoice } from '..';
import { useSettings } from '../../../context/SettingsContext';
import { UserSettingsModal } from '../../../components/modals/UserSettingsModal';

// --- Helper Components ---
const DialButton = ({ 
    active, 
    onClick, 
    icon, 
    danger = false, 
    className = "" 
}: { 
    active?: boolean, 
    onClick: () => void, 
    icon: React.ReactNode, 
    danger?: boolean, 
    className?: string 
}) => (
    <button
        onClick={onClick}
        className={`h-12 w-14 flex items-center justify-center rounded-lg transition-all active:scale-95 ${className} ${
            danger 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : active 
                    ? 'bg-white text-black hover:bg-gray-200' 
                    : 'bg-[#2b2d31] text-gray-100 hover:bg-[#3f4147]'
        }`}
    >
        {icon}
    </button>
);

const DialGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-0.5 bg-[#111214] p-1 rounded-lg">
        {children}
    </div>
);

const CaretButton = ({ onClick }: { onClick: () => void }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="h-12 w-5 flex items-center justify-center rounded-r-lg bg-[#2b2d31] hover:bg-[#3f4147] text-gray-300 border-l border-[#1e1f22]"
    >
        <ChevronUp size={12} />
    </button>
);

const ContextMenu = ({ onClose, children }: { onClose: () => void, children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} className="absolute bottom-[115%] left-0 w-64 bg-[#111214] border border-[#1e1f22] rounded-lg shadow-xl p-1 z-50 text-gray-200 animate-in slide-in-from-bottom-2 duration-150">
            {children}
        </div>
    );
};

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
    activeRoom, connectionState, error, cameraError, screenShareError,
    muted, micMuted, setMuted, setMicMuted,
    isCameraEnabled, isScreenSharing, isPublishingCamera, isPublishingScreen,
    shareSystemAudio, setShareSystemAudio,
    startCamera, stopCamera, startScreenShare, stopScreenShare, toggleCamera, disconnect,
  } = useVoice();
  const { settings, updateDevices } = useSettings();

  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'mic' | 'video' | 'screen' | null>(null);
  
  // Local Device State for Quick Menu
  const [devices, setDevices] = useState<{audio: MediaDeviceInfo[], video: MediaDeviceInfo[]}>({ audio: [], video: [] });
  const [screenSources, setScreenSources] = useState<any[]>([]);

  // Device Loading
  useEffect(() => {
      navigator.mediaDevices.enumerateDevices().then(devs => {
          setDevices({
              audio: devs.filter(d => d.kind === 'audioinput'),
              video: devs.filter(d => d.kind === 'videoinput')
          });
      });
  }, [menuOpen]); // Reload when menu opens

  // Screen Sources
  useEffect(() => {
      if (menuOpen === 'screen' && window.ct?.getScreenSources) {
          window.ct.getScreenSources().then(setScreenSources);
      }
  }, [menuOpen]);

  // Actions
  const handleDeviceSwitch = (type: 'audio'|'video', id: string) => {
      if (type === 'audio') updateDevices({ audioInputId: id });
      if (type === 'video') {
          updateDevices({ videoInputId: id });
          if(isCameraEnabled) { stopCamera().then(() => startCamera(settings.talk.cameraQuality)); }
      }
      setMenuOpen(null);
  };

  const handleScreenShare = async (sourceId?: string) => {
      if (isScreenSharing) {
          await stopScreenShare();
      } else {
          await startScreenShare({
              ...(sourceId ? { sourceId } : {}),
              quality: settings.talk.screenQuality ?? 'high',
              frameRate: settings.talk.screenFrameRate ?? 30,
              bitrateProfile: settings.talk.screenBitrateProfile ?? 'medium',
              withAudio: shareSystemAudio
          });
      }
      setMenuOpen(null);
  };

  const statusColor = connectionState === 'connected' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex-1 flex flex-col h-full bg-black relative select-none">
        
        {/* Top Bar (Overlay) */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between pointer-events-none">
            <div className="pointer-events-auto bg-black/60 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-3 border border-white/5">
                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                <div className="text-sm font-bold text-white">{channelName || 'Unbenannt'}</div>
            </div>
            <div className="pointer-events-auto bg-black/60 backdrop-blur rounded-lg p-1 flex gap-1 border border-white/5">
                <button onClick={() => setLayout('grid')} className={`p-2 rounded ${layout === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}><Grid size={18}/></button>
                <button onClick={() => setLayout('speaker')} className={`p-2 rounded ${layout === 'speaker' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}><LayoutList size={18}/></button>
            </div>
        </div>

        {/* Stage */}
        <div className="flex-1 overflow-hidden relative">
            {activeRoom ? (
                <VoiceMediaStage layout={layout} />
            ) : (
                <div className="flex h-full items-center justify-center text-gray-500 gap-2">
                    <RefreshCw className="animate-spin" size={24}/>
                    <span>Verbinde...</span>
                </div>
            )}
            
            {/* Error Toast */}
            {(error || cameraError) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-xl flex gap-2 items-center">
                    <XCircle size={16}/> {error || cameraError}
                </div>
            )}
        </div>

        {/* Bottom Control Bar (Dial) */}
        <div className="bg-[#000000] p-4 pb-6 flex justify-center items-center gap-4 relative z-20 shadow-[0_-1px_0_rgba(255,255,255,0.05)]">
            
            <DialGroup>
                {/* MIC + MENU */}
                <div className="relative flex items-center">
                    <DialButton 
                        icon={micMuted ? <MicOff size={22}/> : <Mic size={22}/>} 
                        onClick={() => setMicMuted(!micMuted)} 
                        active={!micMuted}
                        className={micMuted ? "text-red-400 !bg-[#2b2d31]" : ""}
                        danger={micMuted}
                    />
                    <CaretButton onClick={() => setMenuOpen(menuOpen === 'mic' ? null : 'mic')} />
                    
                    {menuOpen === 'mic' && (
                        <ContextMenu onClose={() => setMenuOpen(null)}>
                            <div className="text-[10px] uppercase font-bold text-gray-500 px-3 py-2">Eingabegerät</div>
                            {devices.audio.map(d => (
                                <button key={d.deviceId} onClick={() => handleDeviceSwitch('audio', d.deviceId)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded flex justify-between items-center">
                                    <span className="truncate">{d.label}</span>
                                    {settings.devices.audioInputId === d.deviceId && <Check size={14} className="text-green-400"/>}
                                </button>
                            ))}
                            <div className="h-px bg-white/10 my-1"/>
                            <button onClick={() => { setShowSettings(true); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded flex gap-2 items-center">
                                <Settings size={14} /> Audioeinstellungen
                            </button>
                        </ContextMenu>
                    )}
                </div>

                {/* DEAFEN */}
                <DialButton 
                    icon={<Headphones size={22} className={muted ? "opacity-50" : ""}/>} 
                    onClick={() => setMuted(!muted)} 
                    active={!muted}
                    danger={muted}
                    className="ml-0.5 rounded-l-none" // visual merge if wanted, here separated by gap-0.5 in DialGroup
                />
            </DialGroup>

            {/* VIDEO + SCREEN */}
            <DialGroup>
                {/* CAMERA + MENU */}
                <div className="relative flex items-center">
                    <DialButton 
                        icon={isCameraEnabled ? <Video size={22}/> : <VideoOff size={22}/>} 
                        onClick={toggleCamera} 
                        active={isCameraEnabled}
                    />
                    <CaretButton onClick={() => setMenuOpen(menuOpen === 'video' ? null : 'video')} />
                    {menuOpen === 'video' && (
                        <ContextMenu onClose={() => setMenuOpen(null)}>
                             <div className="text-[10px] uppercase font-bold text-gray-500 px-3 py-2">Kamera wählen</div>
                             {devices.video.map(d => (
                                <button key={d.deviceId} onClick={() => handleDeviceSwitch('video', d.deviceId)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded flex justify-between items-center">
                                    <span className="truncate">{d.label}</span>
                                    {settings.devices.videoInputId === d.deviceId && <Check size={14} className="text-green-400"/>}
                                </button>
                            ))}
                        </ContextMenu>
                    )}
                </div>

                {/* SCREEN + MENU */}
                <div className="relative flex items-center ml-0.5">
                    <DialButton 
                        icon={isScreenSharing ? <MonitorOff size={22}/> : <Monitor size={22}/>} 
                        onClick={() => handleScreenShare()} 
                        active={isScreenSharing}
                        className={isScreenSharing ? "text-green-400 !bg-[#111214]" : ""}
                    />
                     <CaretButton onClick={() => setMenuOpen(menuOpen === 'screen' ? null : 'screen')} />
                     {menuOpen === 'screen' && !isScreenSharing && (
                         <ContextMenu onClose={() => setMenuOpen(null)}>
                            <div className="text-[10px] uppercase font-bold text-gray-500 px-3 py-2">Bildschirm freigeben</div>
                            {screenSources.length > 0 ? screenSources.map(s => (
                                <button key={s.id} onClick={() => handleScreenShare(s.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded flex gap-2 items-center">
                                    {s.thumbnail ? <img src={s.thumbnail} className="w-5 h-5 rounded"/> : <Laptop2 size={16}/>}
                                    <span className="truncate">{s.name}</span>
                                </button>
                            )) : (
                                <div className="px-3 py-2 text-xs text-gray-500 italic">Browser-Dialog öffnet bei Klick auf Icon</div>
                            )}
                            <div className="h-px bg-white/10 my-1"/>
                            <button onClick={() => { setShowSettings(true); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded flex gap-2 items-center">
                                <Sliders size={14} /> Qualität ändern
                            </button>
                         </ContextMenu>
                     )}
                </div>
            </DialGroup>

            {/* DISCONNECT */}
            <DialButton 
                icon={<PhoneOff size={24} fill="currentColor"/>} 
                onClick={disconnect} 
                danger 
                className="rounded-full !w-16 ml-2" 
            />

        </div>

        {/* Modal */}
        {showSettings && (
            <UserSettingsModal
                onClose={() => setShowSettings(false)}
                initialCategory="devices"
                initialDevicesTab="stream"
            />
        )}

    </div>
  );
};