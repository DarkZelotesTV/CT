import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  Grid,
  Headphones,
  LayoutList,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Video,
  VideoOff,
  XCircle,
  Check,
} from 'lucide-react';

import { useVoice } from '../..'; 
// 3. Settings und Modals (vier Ebenen hoch bis src/)
import { useSettings } from '../../../../context/SettingsContext';
import { UserSettingsModal } from '../../../../components/modals/UserSettingsModal';
import { IconButton, ToggleIconButton, Button } from '../../../../components/ui/Button';

const ContextMenu = ({ onClose, children }: { onClose: () => void, children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} className="absolute bottom-[115%] left-0 w-64 bg-surface border border-border rounded-2xl shadow-glass p-1.5 z-50 text-text animate-in slide-in-from-bottom-2 duration-150">
            {children}
        </div>
    );
};

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
    connectionState, error,
    muted, micMuted, setMuted, setMicMuted,
    isCameraEnabled, isScreenSharing,
    stopCamera, startCamera, stopScreenShare, toggleCamera, disconnect, toggleScreenShare,
    getNativeHandle,
    participants,
    activeSpeakerIds,
    providerRenderers,
  } = useVoice();
  const { settings, updateDevices } = useSettings();
  const MediaStage = providerRenderers.MediaStage;
  const nativeHandle = getNativeHandle?.();

  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'mic' | 'video' | 'screen' | null>(null);
  const [devices, setDevices] = useState<{audio: MediaDeviceInfo[], video: MediaDeviceInfo[]}>({ audio: [], video: [] });

  useEffect(() => {
      navigator.mediaDevices.enumerateDevices().then(devs => {
          setDevices({
              audio: devs.filter(d => d.kind === 'audioinput'),
              video: devs.filter(d => d.kind === 'videoinput')
          });
      });
  }, [menuOpen]);

  const handleDeviceSwitch = (type: 'audio'|'video', id: string) => {
      if (type === 'audio') updateDevices({ audioInputId: id });
      if (type === 'video') {
          updateDevices({ videoInputId: id });
          if(isCameraEnabled) { stopCamera().then(() => startCamera(settings.talk.cameraQuality)); }
      }
      setMenuOpen(null);
  };

  const statusColor = connectionState === 'connected' ? 'bg-green-500 shadow-neon' : 'bg-yellow-500';
  const canRenderStage = Boolean(MediaStage) && connectionState === 'connected';

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative select-none">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between pointer-events-none">
            <div className="pointer-events-auto bg-surface/60 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-3 border border-border shadow-glass">
                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                <div className="text-sm font-bold text-text truncate max-w-[200px]">{channelName || 'Unbenannt'}</div>
            </div>
            <div className="pointer-events-auto bg-surface/60 backdrop-blur-md rounded-2xl p-1 flex gap-1 border border-border shadow-glass">
                <IconButton size="sm" variant={layout === 'grid' ? 'primary' : 'ghost'} onClick={() => setLayout('grid')}><Grid size={18}/></IconButton>
                <IconButton size="sm" variant={layout === 'speaker' ? 'primary' : 'ghost'} onClick={() => setLayout('speaker')}><LayoutList size={18}/></IconButton>
            </div>
        </div>

        {/* Media Content Area */}
        <div className="flex-1 overflow-hidden relative">
            {canRenderStage && MediaStage ? (
              <MediaStage
                layout={layout}
                participants={participants}
                activeSpeakerIds={activeSpeakerIds}
                connectionState={connectionState}
                nativeHandle={nativeHandle}
              />
            ) : (
                <div className="flex h-full items-center justify-center text-text-muted gap-2 font-semibold bg-background/50">
                   {connectionState === 'connected' ? 'Voice-Provider wird initialisiert...' : 'Verbinde...'}
                </div>
            )}
            
            {error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl text-xs border border-red-500/30 flex gap-2 items-center">
                    <XCircle size={14}/> {error}
                </div>
            )}
        </div>

        {/* Bottom Control Dial */}
        <div className="bg-surface p-4 pb-6 flex justify-center items-center gap-4 relative z-20 border-t border-border shadow-glass">
            <div className="flex items-center gap-1 bg-surface-alt p-1.5 rounded-2xl border border-border">
                <ToggleIconButton pressed={!micMuted} onClick={() => setMicMuted(!micMuted)} variant={micMuted ? 'danger' : 'secondary'}>
                    {micMuted ? <MicOff size={22}/> : <Mic size={22}/>}
                </ToggleIconButton>
                <IconButton size="sm" variant="ghost" onClick={() => setMenuOpen(menuOpen === 'mic' ? null : 'mic')}>
                    <ChevronUp size={14} />
                </IconButton>
                {menuOpen === 'mic' && (
                    <ContextMenu onClose={() => setMenuOpen(null)}>
                        <div className="text-[10px] uppercase font-bold text-text-muted px-3 py-2">Eingabe</div>
                        {devices.audio.map(d => (
                            <button key={d.deviceId} onClick={() => handleDeviceSwitch('audio', d.deviceId)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 rounded-xl flex justify-between items-center text-text transition-colors">
                                <span className="truncate">{d.label || 'Mikrofon'}</span>
                                {settings.devices.audioInputId === d.deviceId && <Check size={14} className="text-accent"/>}
                            </button>
                        ))}
                    </ContextMenu>
                )}
                <div className="w-px h-6 bg-border mx-1" />
                <ToggleIconButton pressed={!muted} onClick={() => setMuted(!muted)} variant={muted ? 'danger' : 'secondary'}>
                    <Headphones size={22} />
                </ToggleIconButton>
            </div>

            <div className="flex items-center gap-1 bg-surface-alt p-1.5 rounded-2xl border border-border">
                <ToggleIconButton pressed={isCameraEnabled} onClick={toggleCamera}>
                    {isCameraEnabled ? <Video size={22}/> : <VideoOff size={22}/>}
                </ToggleIconButton>
                <div className="w-px h-6 bg-border mx-1" />
                <ToggleIconButton pressed={isScreenSharing} onClick={() => isScreenSharing ? stopScreenShare() : toggleScreenShare()}>
                    <Monitor size={22}/>
                </ToggleIconButton>
            </div>

            <Button variant="danger" className="rounded-full w-16 h-12 shadow-lg" onClick={disconnect}>
                <PhoneOff size={24} fill="currentColor"/>
            </Button>
        </div>

        {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} initialCategory="devices" />}
    </div>
  );
};
