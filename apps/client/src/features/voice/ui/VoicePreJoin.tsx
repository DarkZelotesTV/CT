import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Headphones, Info, Loader2, Mic, MicOff, RefreshCw, Settings, Volume2, VolumeX, Video, Monitor } from 'lucide-react';
import { useVoice } from '..';
import { useSettings } from '../../context/SettingsContext';

type VoicePreJoinProps = {
  channel: { id: number; name: string };
  onJoin: () => Promise<void> | void;
  onCancel: () => void;
  isJoining?: boolean;
  connectedChannelName?: string | null;
  connectedElsewhere?: boolean;
};

export const VoicePreJoin = ({ channel, onJoin, onCancel, isJoining, connectedChannelName, connectedElsewhere }: VoicePreJoinProps) => {
  const {
    connectionState,
    error,
    muted,
    micMuted,
    setMuted,
    setMicMuted,
    usePushToTalk,
    setPushToTalk,
    outputVolume,
    setOutputVolume,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
  } = useVoice();
  const { settings, updateDevices } = useSettings();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [volumePercent, setVolumePercent] = useState(Math.round((outputVolume ?? 1) * 100));
  const [submitting, setSubmitting] = useState(false);

  // Initial Device Load
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    setLoadingDevices(true);
    setLocalError(null);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    } catch (err: any) {
      setLocalError(err?.message || 'Geräte konnten nicht geladen werden.');
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // Sync Volume State
  useEffect(() => {
    setVolumePercent(Math.round((outputVolume ?? 1) * 100));
  }, [outputVolume]);

  const handleDeviceChange = (type: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
    updateDevices({
      audioInputId: type === 'audioinput' ? deviceId || null : settings.devices.audioInputId,
      audioOutputId: type === 'audiooutput' ? deviceId || null : settings.devices.audioOutputId,
      videoInputId: type === 'videoinput' ? deviceId || null : settings.devices.videoInputId,
    });
  };

  const handleVolumeChange = async (value: number) => {
    const normalized = Math.max(0, Math.min(200, value));
    setVolumePercent(normalized);
    await setOutputVolume(normalized / 100);
  };

  const handleJoin = async () => {
    setSubmitting(true);
    try {
      await onJoin();
    } catch (err: any) {
      setLocalError(err?.message || 'Verbindung konnte nicht aufgebaut werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const connectionLabel = useMemo(() => {
    if (connectionState === 'connecting' || isJoining) return 'Verbindung wird aufgebaut...';
    if (connectionState === 'reconnecting') return 'Verbindung wird wiederhergestellt...';
    if (connectionState === 'connected') return 'Bereit für den Talk';
    return 'Nicht verbunden';
  }, [connectionState, isJoining]);

  const infoText = connectedElsewhere && connectedChannelName
    ? `Du bist aktuell mit "${connectedChannelName}" verbunden. Ein Beitritt wechselt den Kanal.`
    : 'Bitte prüfe deine Geräte-Einstellungen vor dem Beitritt.';

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-[#0b0c10] via-[#0d0f15] to-[#0b0c10] relative font-sans overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none fixed" style={{
        backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.05), transparent 30%), radial-gradient(circle at 85% 85%, rgba(16, 185, 129, 0.05), transparent 30%)',
      }} />

      {/* Main Scroll Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
        {/* FIX: 'items-center' entfernt, damit Inhalt bei Überlauf nicht oben abgeschnitten wird. 'my-auto' im Kind-Element regelt die Zentrierung. */}
        <div className="min-h-full flex flex-col p-4 md:p-8">
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 relative z-10 my-auto mx-auto">
            
            {/* LEFT COLUMN: Controls */}
            <div className="bg-[#0f1117]/90 border border-white/10 rounded-3xl shadow-2xl p-5 md:p-8 backdrop-blur-xl flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              {/* Header Area */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 md:pb-6">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-500 font-bold mb-1">Voice Check</div>
                  <div className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
                    <span className="truncate max-w-full md:max-w-md">{channel.name}</span>
                    <ChevronRight className="text-gray-600 hidden md:block shrink-0" size={20} />
                    <span className="text-sm font-medium text-gray-400 hidden md:block shrink-0">Eingangshalle</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-medium">
                    {isJoining || connectionState === 'connecting' 
                      ? <Loader2 size={12} className="animate-spin text-cyan-400 shrink-0" /> 
                      : <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    }
                    <span className="text-gray-400 truncate">{connectionLabel}</span>
                  </div>
                </div>

                <button
                  onClick={refreshDevices}
                  disabled={loadingDevices}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 transition-all hover:border-white/20 active:scale-95 w-full md:w-auto shrink-0"
                >
                  <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} />
                  <span>Geräte neu laden</span>
                </button>
              </div>

              {/* Device Cards Grid */}
              {/* FIX: 'lg:grid-cols-1' hinzugefügt. Auf Laptops (lg) eine Spalte, damit es nicht gequetscht wird. Ab Desktop (xl) wieder zwei Spalten. */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                
                {/* 1. Microphone */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 ${micMuted ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Mic size={16} className={micMuted ? "text-red-400" : "text-cyan-400"} /> 
                        Mikrofon
                      </div>
                      <button
                        onClick={() => setMicMuted(!micMuted)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wide border transition-all shrink-0 ${micMuted ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20'}`}
                      >
                        {micMuted ? 'Stumm' : 'Live'}
                      </button>
                   </div>
                   <div className="relative">
                      <select
                        value={selectedAudioInputId || ''}
                        onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 appearance-none transition-colors pr-8"
                      >
                        <option value="">Standard Mikrofon</option>
                        {audioInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unbenanntes Mikrofon'}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-3 pointer-events-none text-gray-500"><Settings size={12}/></div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Push-to-Talk</span>
                      <button onClick={() => setPushToTalk(!usePushToTalk)} className={`px-2 py-1 rounded transition-colors ${usePushToTalk ? 'text-cyan-400 bg-cyan-950/30' : 'text-gray-500 hover:text-gray-300'}`}>
                        {usePushToTalk ? 'Aktiv' : 'Inaktiv'}
                      </button>
                   </div>
                </div>

                {/* 2. Output / Speaker */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 ${muted ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Headphones size={16} className={muted ? "text-red-400" : "text-cyan-400"} /> 
                        Ausgabe
                      </div>
                      <button
                        onClick={() => setMuted(!muted)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wide border transition-all shrink-0 ${muted ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-white/10 border-white/10 text-gray-300 hover:bg-white/15'}`}
                      >
                        {muted ? 'Stumm' : 'Hörbar'}
                      </button>
                   </div>
                   <div className="relative mb-3">
                      <select
                        value={selectedAudioOutputId || ''}
                        onChange={(e) => handleDeviceChange('audiooutput', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 appearance-none transition-colors pr-8"
                      >
                        <option value="">Systemausgabe</option>
                        {audioOutputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Lautsprecher'}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-3 pointer-events-none text-gray-500"><Settings size={12}/></div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => handleVolumeChange(0)} className="text-gray-500 hover:text-gray-300"><VolumeX size={14}/></button>
                      <input
                        type="range"
                        min={0} max={200}
                        value={volumePercent}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-cyan-400 w-8 text-right">{volumePercent}%</span>
                   </div>
                </div>

                {/* 3. Camera */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Video size={16} className="text-purple-400" /> 
                        Kamera
                      </div>
                      <span className="text-[10px] uppercase text-gray-600 font-bold bg-black/20 px-2 py-1 rounded shrink-0">Optional</span>
                    </div>
                    <div className="relative mb-2">
                      <select
                        value={selectedVideoInputId || ''}
                        onChange={(e) => handleDeviceChange('videoinput', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 appearance-none transition-colors pr-8"
                      >
                        <option value="">Keine Kamera</option>
                        {videoInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-3 pointer-events-none text-gray-500"><Settings size={12}/></div>
                    </div>
                    <div className="text-[10px] text-gray-500 leading-relaxed">
                        Die Kamera ist beim Beitritt standardmäßig deaktiviert, kann aber im Channel jederzeit eingeschaltet werden.
                    </div>
                </div>

                {/* 4. Info Card */}
                 <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col justify-center">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-400 shrink-0">
                            <Info size={16} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-indigo-100 mb-1">Hinweis</div>
                            <p className="text-[11px] text-indigo-200/70 leading-relaxed">
                                {infoText}
                            </p>
                        </div>
                    </div>
                 </div>

              </div>

              {/* Global Error Banner */}
              {(error || localError) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="p-1.5 bg-red-500/20 rounded-full text-red-400 shrink-0"><MicOff size={14}/></div>
                    <span className="text-xs text-red-200 font-medium">{error || localError}</span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Summary & Join (Sticky on Desktop) */}
            <div className="bg-[#0f1117]/90 border border-white/10 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 backdrop-blur-xl h-fit lg:sticky lg:top-8 animate-in slide-in-from-bottom-8 duration-700">
               
               <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 shrink-0">
                      {channel.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden flex-1">
                      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Beitreten in</div>
                      <div className="text-lg font-bold text-white truncate" title={channel.name}>{channel.name}</div>
                  </div>
               </div>

               <div className="bg-white/5 rounded-2xl p-4 space-y-3 border border-white/5">
                   <div className="flex items-center justify-between text-xs">
                       <span className="text-gray-400">Status</span>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${connectionState === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                           {connectionState === 'connected' ? 'Verbunden' : 'Warte...'}
                       </span>
                   </div>
                   <div className="h-px bg-white/5" />
                   <div className="flex items-center justify-between text-xs">
                       <span className="text-gray-400 flex items-center gap-1.5"><Mic size={12}/> Mikrofon</span>
                       <span className={micMuted ? "text-red-400 font-medium" : "text-gray-200"}>{micMuted ? 'Stumm' : 'Aktiv'}</span>
                   </div>
                   <div className="flex items-center justify-between text-xs">
                       <span className="text-gray-400 flex items-center gap-1.5"><Headphones size={12}/> Sound</span>
                       <span className={muted ? "text-red-400 font-medium" : "text-gray-200"}>{muted ? 'Aus' : `${volumePercent}%`}</span>
                   </div>
               </div>

               <div className="mt-auto space-y-3 pt-2">
                   <button
                    onClick={handleJoin}
                    disabled={isJoining || submitting}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                   >
                     {(isJoining || submitting) && <Loader2 size={16} className="animate-spin" />}
                     {isJoining || submitting ? 'Verbinde...' : 'Jetzt beitreten'}
                   </button>
                   <button
                    onClick={onCancel}
                    className="w-full py-3 rounded-xl bg-transparent border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/20 font-semibold text-xs transition-colors"
                   >
                     Abbrechen
                   </button>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};