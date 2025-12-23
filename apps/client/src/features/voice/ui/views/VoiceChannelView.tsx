import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, ChevronUp, Grid, Headphones, Laptop2, LayoutList, Mic, MicOff,
  Monitor, MonitorOff, PhoneOff, RefreshCw, Settings, Sliders, Video, VideoOff, XCircle,
} from 'lucide-react';
import { VoiceMediaStage } from '../tabs/VoiceMediaStage';
import { useVoice } from '../..';
import { useSettings } from '../../../../context/SettingsContext';
import { UserSettingsModal } from '../../../../components/modals/UserSettingsModal';

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
    activeRoom, connectionState, error, cameraError, muted, micMuted, setMuted, setMicMuted,
    isCameraEnabled, isScreenSharing, toggleCamera, disconnect, startScreenShare, stopScreenShare, shareSystemAudio
  } = useVoice();
  const { settings, updateDevices } = useSettings();

  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'mic' | 'video' | 'screen' | null>(null);
  
  const statusColor = connectionState === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative select-none font-sans overflow-hidden">
        
        {/* Background Decorative Blur */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Top Header - Glassmorphism */}
        <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none">
            <div className="pointer-events-auto bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl transition-all hover:bg-white/10">
                <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Verbunden mit</span>
                  <span className="text-sm font-black text-white">{channelName || 'Sprachkanal'}</span>
                </div>
            </div>

            <div className="pointer-events-auto flex gap-2 p-1.5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
                <button onClick={() => setLayout('grid')} className={`p-2.5 rounded-xl transition-all ${layout === 'grid' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Grid size={20}/>
                </button>
                <button onClick={() => setLayout('speaker')} className={`p-2.5 rounded-xl transition-all ${layout === 'speaker' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <LayoutList size={20}/>
                </button>
            </div>
        </div>

        {/* Stage Area */}
        <div className="flex-1 relative z-10">
            {activeRoom ? (
                <VoiceMediaStage layout={layout} />
            ) : (
                <div className="flex h-full flex-col items-center justify-center text-gray-400 gap-5">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center animate-spin border-t-2 border-indigo-500 shadow-xl">
                      <RefreshCw size={32} className="text-indigo-400" />
                    </div>
                    <span className="font-bold tracking-tighter text-lg animate-pulse">Initialisiere Stream...</span>
                </div>
            )}
        </div>

        {/* Bottom Control Dial - Floating High-End Design */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-full max-w-2xl px-6">
            <div className="pointer-events-auto flex items-center justify-center gap-4 p-3 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                
                {/* Audio Controls */}
                <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl">
                    <button onClick={() => setMicMuted(!micMuted)} className={`p-4 rounded-xl transition-all active:scale-90 ${micMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white hover:bg-white/10'}`}>
                      {micMuted ? <MicOff size={24}/> : <Mic size={24}/>}
                    </button>
                    <button onClick={() => setMuted(!muted)} className={`p-4 rounded-xl transition-all active:scale-90 ${muted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white hover:bg-white/10'}`}>
                      <Headphones size={24}/>
                    </button>
                </div>

                {/* Media Controls */}
                <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl">
                    <button onClick={toggleCamera} className={`p-4 rounded-xl transition-all active:scale-90 ${isCameraEnabled ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-white hover:bg-white/10'}`}>
                      <Video size={24}/>
                    </button>
                    <button onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()} className={`p-4 rounded-xl transition-all active:scale-90 ${isScreenSharing ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-white hover:bg-white/10'}`}>
                      <Monitor size={24}/>
                    </button>
                </div>

                {/* Settings & Disconnect */}
                <button onClick={() => setShowSettings(true)} className="p-4 rounded-xl text-gray-400 hover:text-white transition-all bg-white/5">
                    <Settings size={24}/>
                </button>

                <button onClick={disconnect} className="p-5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-all shadow-xl shadow-red-600/30 active:scale-90 ml-2">
                    <PhoneOff size={28} fill="currentColor"/>
                </button>
            </div>
        </div>

        {/* Error Notifications */}
        {(error || cameraError) && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 text-red-200 px-6 py-3 rounded-2xl text-sm flex gap-3 items-center animate-in slide-in-from-top-4">
                <XCircle size={20} className="text-red-500"/> {error || cameraError}
            </div>
        )}

        {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} initialCategory="devices" initialDevicesTab="stream" />}
    </div>
  );
};