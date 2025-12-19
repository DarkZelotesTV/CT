import { useCallback, useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from './modalRoot';
import { 
  Check, 
  X, 
  Mic, 
  Video, 
  Monitor, 
  ChevronDown,
  Settings,
  Volume2
} from 'lucide-react';

import { useSettings } from '../../context/SettingsContext';
import { useVoice } from '../../context/voice-state';

const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

// --- Helper Components ---

const HotkeyInput = ({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Escape') { 
        onChange(''); 
        setIsRecording(false);
        return; 
    }
    
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    
    if (!modifierKeys.includes(e.key)) {
      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyName);
      onChange(parts.join('+'));
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
      <div className="flex gap-2">
          <div 
            onClick={() => setIsRecording(true)}
            className={`flex-1 bg-black/40 border rounded-xl px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between font-mono ${isRecording ? 'border-red-500/50 text-white ring-1 ring-red-500/20' : 'border-white/10 text-gray-300 hover:border-white/20'}`}
          >
              <span>{isRecording ? 'Tastenkombination drücken...' : (value || 'Keine Taste zugewiesen')}</span>
              {value && !isRecording && (
                  <button onClick={(e) => { e.stopPropagation(); onChange(''); }} className="hover:text-red-400 transition-colors"><X size={14}/></button>
              )}
          </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 mt-2 flex items-center gap-2">
        {children}
    </h3>
);

const DeviceSelect = ({ label, value, options, onChange }: { label: string, value: string, options: MediaDeviceInfo[], onChange: (val: string) => void }) => (
    <div className="space-y-1.5 w-full">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
        <div className="relative">
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-black/40 text-gray-200 text-sm p-3 pr-8 rounded-xl border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none appearance-none cursor-pointer truncate font-medium transition-all hover:bg-black/60"
            >
                <option value="">Systemstandard</option>
                {options.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Gerät ${d.deviceId.slice(0,5)}...`}</option>
                ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none"/>
        </div>
    </div>
);

export const TalkSettingsModal = ({ onClose, initialTab = 'voice' }: { onClose: () => void; initialTab?: 'voice' | 'stream' }) => {
  const { settings, updateDevices, updateHotkeys, updateTalk } = useSettings();
  const {
    muted, micMuted, usePushToTalk,
    setMuted, setMicMuted, setPushToTalk,
    rnnoiseEnabled, rnnoiseAvailable, rnnoiseError, setRnnoiseEnabled,
    selectedAudioInputId, selectedAudioOutputId, selectedVideoInputId
  } = useVoice();

  // Navigation
  const [activeTab, setActiveTab] = useState<'voice' | 'stream'>(initialTab);

  // --- AUDIO STATE ---
  const [audioInputId, setAudioInputId] = useState(selectedAudioInputId || '');
  const [audioOutputId, setAudioOutputId] = useState(selectedAudioOutputId || '');
  
  // Input Mode
  const [inputMode, setInputMode] = useState<'vad' | 'ptt'>(usePushToTalk ? 'ptt' : 'vad');
  const [pushToTalkKey, setPushToTalkKey] = useState(settings.hotkeys.pushToTalk || '');
  const [sensitivity, setSensitivity] = useState(settings.talk.vadSensitivity ?? 50);
  
  // Mic Test
  const [inputLevel, setInputLevel] = useState(0);

  // --- VIDEO STATE ---
  const [videoInputId, setVideoInputId] = useState(selectedVideoInputId || '');
  const [cameraQuality, setCameraQuality] = useState(settings.talk.cameraQuality || 'medium');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // --- STREAM STATE ---
  const [screenQuality, setScreenQuality] = useState(settings.talk.screenQuality || 'high');
  const [screenFps, setScreenFps] = useState(settings.talk.screenFrameRate || 30);
  
  // --- ADVANCED ---
  const [useRnnoise, setUseRnnoise] = useState(rnnoiseEnabled);
  const [echoCancellation, setEchoCancellation] = useState(true);

  // Device Lists
  const [devices, setDevices] = useState<{ audioIn: MediaDeviceInfo[], audioOut: MediaDeviceInfo[], videoIn: MediaDeviceInfo[] }>({ audioIn: [], audioOut: [], videoIn: [] });

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioIn: all.filter(d => d.kind === 'audioinput'),
        audioOut: all.filter(d => d.kind === 'audiooutput'),
        videoIn: all.filter(d => d.kind === 'videoinput')
      });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // Mic Meter Logic
  useEffect(() => {
    if (activeTab !== 'voice') return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let frame: number;
    let cancelled = false;
    
    const startMeter = async () => {
        try {
            const audioConstraints: MediaTrackConstraints | boolean = audioInputId ? { deviceId: audioInputId } : true;
            stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            if (cancelled) return;

            ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            
            const tick = () => {
                if (cancelled) return;
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (const value of data) {
                    const v = value - 128;
                    sum += v*v;
                }
                const rms = Math.sqrt(sum/data.length) / 128;
                setInputLevel(prev => prev * 0.7 + (rms * 10) * 0.3); 
                frame = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {}
    };
    startMeter();
    return () => {
        cancelled = true;
        if(frame) cancelAnimationFrame(frame);
        stream?.getTracks().forEach(t => t.stop());
        ctx?.close();
    }
  }, [activeTab, audioInputId]);

  // Video Preview Logic
  useEffect(() => {
      if (activeTab !== 'voice') return;
      let stream: MediaStream | null = null;
      const startCam = async () => {
          try {
              if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
              if (!videoInputId) return;
              
              stream = await navigator.mediaDevices.getUserMedia({ 
                  video: { 
                      deviceId: videoInputId,
                      width: { ideal: 640 },
                      height: { ideal: 360 }
                   } 
              });
              if (videoPreviewRef.current) {
                  videoPreviewRef.current.srcObject = stream;
                  videoPreviewRef.current.play().catch(() => {});
              }
          } catch (e) {}
      };
      startCam();
      return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [activeTab, videoInputId]);


  const handleSave = async () => {
      updateDevices({ 
          audioInputId: audioInputId || null, 
          audioOutputId: audioOutputId || null, 
          videoInputId: videoInputId || null 
      });
      updateHotkeys({ pushToTalk: pushToTalkKey || null });
      updateTalk({ 
          cameraQuality: cameraQuality as any, 
          screenQuality: screenQuality as any, 
          screenFrameRate: screenFps,
          vadSensitivity: sensitivity
      });
      
      await setPushToTalk(inputMode === 'ptt');
      await setRnnoiseEnabled(useRnnoise);
      
      onClose();
  };

  const hasUnsavedChanges = useMemo(() => {
      return inputMode !== (usePushToTalk ? 'ptt' : 'vad') || audioInputId !== selectedAudioInputId;
  }, [inputMode, usePushToTalk, audioInputId, selectedAudioInputId]);

	const target = getModalRoot();
	if (!target) return null;


  return createPortal(
	  <div
	    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4 md:p-8"
	    style={{ zIndex: 2147483647, transform: 'translateZ(0)', willChange: 'transform' }}
	  >
      <div className="w-full max-w-5xl h-[85vh] bg-[#0f1014] rounded-3xl border border-white/10 shadow-2xl flex overflow-hidden text-gray-200 font-sans">
          
          {/* Sidebar */}
          <div className="w-64 bg-white/[0.02] border-r border-white/5 flex-shrink-0 flex flex-col pt-8 pb-4 px-3 overflow-y-auto hidden md:flex">
             <div className="px-3 mb-4 text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Settings size={14}/> Einstellungen
             </div>
             
             <div className="space-y-1">
                 <button 
                    onClick={() => setActiveTab('voice')}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'voice' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}`}
                 >
                     Voice & Video
                 </button>
                 <button 
                    onClick={() => setActiveTab('stream')}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'stream' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}`}
                 >
                     Stream Qualität
                 </button>
             </div>
             
             <div className="mt-auto pt-4 border-t border-white/5">
                 <button onClick={onClose} className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors font-medium flex items-center gap-2">
                     <X size={16} /> Schließen
                 </button>
             </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-[#0f1014] relative min-w-0">
             
             {/* Header (Mobile only) */}
             <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5">
                 <h2 className="text-lg font-bold text-white">Einstellungen</h2>
                 <button onClick={onClose}><X size={20}/></button>
             </div>

             {/* Content Header (Desktop) */}
             <div className="hidden md:block pt-10 px-12 pb-6 shrink-0">
                 <h2 className="text-2xl font-bold text-white mb-2">
                     {activeTab === 'voice' ? 'Voice & Video' : 'Stream Qualität'}
                 </h2>
                 <p className="text-sm text-gray-400">
                     {activeTab === 'voice' ? 'Passe deine Audio- und Videogeräte an.' : 'Optimiere deine Bildschirmübertragung.'}
                 </p>
             </div>

             {/* Scrollable Area */}
             <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 pb-24 space-y-8">
                 
                 {/* VOICE TAB */}
                 {activeTab === 'voice' && (
                     <>
                        {/* Devices */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8 border-b border-white/5">
                            <DeviceSelect 
                                label="Eingabegerät" 
                                value={audioInputId} 
                                options={devices.audioIn} 
                                onChange={setAudioInputId} 
                            />
                            <DeviceSelect 
                                label="Ausgabegerät" 
                                value={audioOutputId} 
                                options={devices.audioOut} 
                                onChange={setAudioOutputId} 
                            />
                            {/* Sliders */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Eingabelautstärke</label>
                                <input type="range" className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ausgabelautstärke</label>
                                <input type="range" className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>

                        {/* Mic Test */}
                        <div className="pb-8 border-b border-white/5">
                            <SectionHeader>Mikrofontest</SectionHeader>
                            <div className="text-sm text-gray-400 mb-4">Probleme mit dem Mikrofon? Sag was und schau, ob der Balken ausschlägt.</div>
                            <div className="bg-black/40 p-5 rounded-2xl border border-white/10">
                                <div className="h-3 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-75 ease-out shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                                        style={{ width: `${Math.min(100, inputLevel * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Input Mode */}
                        <div className="pb-8 border-b border-white/5">
                            <SectionHeader>Eingabemodus</SectionHeader>
                            <div className="flex flex-col gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-transparent hover:bg-white/5 transition-colors">
                                    <input 
                                        type="radio" 
                                        name="inputMode" 
                                        checked={inputMode === 'vad'} 
                                        onChange={() => setInputMode('vad')}
                                        className="w-5 h-5 accent-cyan-500 bg-black/40 border-gray-600" 
                                    />
                                    <span className="text-sm font-medium text-gray-200 group-hover:text-white">Sprachaktivierung</span>
                                </label>
                                
                                {inputMode === 'vad' && (
                                    <div className="pl-4 md:pl-11 pr-4 animate-in slide-in-from-top-1 fade-in">
                                        <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                                            <div className="flex justify-between text-xs text-gray-400 mb-2 font-bold uppercase tracking-widest">
                                                <span>Empfindlichkeit</span>
                                                <span className="text-cyan-400">{sensitivity}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min={0} max={100} 
                                                value={sensitivity} 
                                                onChange={(e) => setSensitivity(Number(e.target.value))}
                                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-cyan-500 cursor-pointer"
                                            />
                                            <div className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                                                Das Mikrofon wird automatisch aktiviert, wenn der Pegel den Schwellenwert überschreitet.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-transparent hover:bg-white/5 transition-colors">
                                    <input 
                                        type="radio" 
                                        name="inputMode" 
                                        checked={inputMode === 'ptt'} 
                                        onChange={() => setInputMode('ptt')}
                                        className="w-5 h-5 accent-cyan-500 bg-black/40 border-gray-600" 
                                    />
                                    <span className="text-sm font-medium text-gray-200 group-hover:text-white">Push-to-Talk</span>
                                </label>

                                {inputMode === 'ptt' && (
                                    <div className="pl-4 md:pl-11 max-w-sm animate-in slide-in-from-top-1 fade-in">
                                        <HotkeyInput label="Taste zuweisen" value={pushToTalkKey} onChange={setPushToTalkKey} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Video Settings */}
                        <div className="pb-8 border-b border-white/5">
                            <SectionHeader><Video size={16}/> Videoeinstellungen</SectionHeader>
                            <div className="space-y-6">
                                <DeviceSelect 
                                    label="Kamera" 
                                    value={videoInputId} 
                                    options={devices.videoIn} 
                                    onChange={setVideoInputId} 
                                />
                                
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vorschau</label>
                                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 relative flex items-center justify-center shadow-lg">
                                        {videoInputId ? (
                                            <>
                                                <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                                                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                                                    Preview
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-6">
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-3">
                                                    <div className="bg-white/5 p-4 rounded-full border border-white/5"><Video size={32} /></div>
                                                    <span className="text-sm font-medium">Keine Kamera ausgewählt</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Advanced */}
                        <div className="pb-6">
                            <SectionHeader>Erweitert</SectionHeader>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                                    <div>
                                        <div className="text-sm font-medium text-gray-200">Echo-Unterdrückung</div>
                                        <div className="text-xs text-gray-500">Verhindert Rückkopplungen.</div>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={echoCancellation} 
                                        onChange={(e) => setEchoCancellation(e.target.checked)}
                                        className="accent-cyan-500 w-5 h-5 cursor-pointer" 
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                                    <div>
                                        <div className="text-sm font-medium text-gray-200">Rauschunterdrückung (RNNoise)</div>
                                        <div className="text-xs text-gray-500">Filtert Hintergrundgeräusche heraus.</div>
                                        {!rnnoiseAvailable && <div className="text-[10px] text-red-400 mt-0.5 font-bold">Nicht verfügbar</div>}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        disabled={!rnnoiseAvailable}
                                        checked={useRnnoise} 
                                        onChange={(e) => setUseRnnoise(e.target.checked)}
                                        className="accent-cyan-500 w-5 h-5 cursor-pointer" 
                                    />
                                </div>
                            </div>
                        </div>
                     </>
                 )}

                 {/* STREAM TAB */}
                 {activeTab === 'stream' && (
                     <div className="animate-in slide-in-from-right-4 duration-300">
                         <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 rounded-2xl border border-indigo-500/20 mb-8 flex gap-5 items-start">
                             <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl h-fit border border-indigo-500/30 shadow-lg shadow-indigo-500/10"><Monitor size={28}/></div>
                             <div>
                                 <h4 className="text-white font-bold text-lg">Stream-Voreinstellungen</h4>
                                 <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                     Hier legst du die Standardqualität für deine Bildschirmübertragungen fest. Höhere Qualität benötigt mehr Bandbreite und CPU-Leistung.
                                 </p>
                             </div>
                         </div>
                         
                         <SectionHeader>Auflösung</SectionHeader>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {['low', 'medium', 'high'].map(q => (
                                <button 
                                    key={q}
                                    onClick={() => setScreenQuality(q as any)}
                                    className={`p-4 rounded-xl border text-left transition-all relative group overflow-hidden ${screenQuality === q ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5'}`}
                                >
                                    <div className={`text-sm font-bold capitalize mb-1 ${screenQuality === q ? 'text-cyan-100' : 'text-gray-300'}`}>{q}</div>
                                    <div className="text-xs text-gray-500">{q === 'low' ? '480p' : q === 'medium' ? '720p' : '1080p Source'}</div>
                                    {screenQuality === q && <div className="absolute top-3 right-3 text-cyan-400"><Check size={16} /></div>}
                                </button>
                            ))}
                         </div>

                         <SectionHeader>Bildrate</SectionHeader>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[15, 30, 60].map(fps => (
                                <button 
                                    key={fps}
                                    onClick={() => setScreenFps(fps)}
                                    className={`p-4 rounded-xl border text-left transition-all relative group ${screenFps === fps ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5'}`}
                                >
                                    <div className={`text-sm font-bold mb-1 ${screenFps === fps ? 'text-cyan-100' : 'text-gray-300'}`}>{fps} FPS</div>
                                    <div className="text-xs text-gray-500">{fps === 60 ? 'Flüssig' : 'Standard'}</div>
                                    {screenFps === fps && <div className="absolute top-3 right-3 text-cyan-400"><Check size={16} /></div>}
                                </button>
                            ))}
                         </div>
                     </div>
                 )}

             </div>

             {/* Footer Actions */}
             <div className="p-6 bg-[#0f1014] border-t border-white/5 flex justify-end gap-3 shrink-0 relative z-10 animate-in slide-in-from-bottom-2">
                 {hasUnsavedChanges && (
                     <div className="absolute left-6 top-1/2 -translate-y-1/2 text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"/>
                         Nicht gespeichert
                     </div>
                 )}
                 <button 
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white text-sm font-medium transition-colors"
                 >
                     Abbrechen
                 </button>
                 <button 
                    onClick={handleSave}
                    className="px-8 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-900/20 transition-all active:scale-95"
                 >
                     Speichern
                 </button>
             </div>

             {/* Close Button Floating (Desktop) */}
             <div className="absolute right-0 top-0 pt-8 pr-6 hidden md:block">
                 <button onClick={onClose} className="flex flex-col items-center gap-1 group text-gray-500 hover:text-white transition-colors">
                     <div className="p-2 rounded-full border-2 border-current opacity-60 group-hover:opacity-100">
                         <X size={16} strokeWidth={3} />
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">ESC</span>
                 </button>
             </div>

          </div>
      </div>
    </div>,
    target
  );
};