import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Headphones,
  Info,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Settings,
  Video,
  VolumeX,
} from 'lucide-react';
// Korrigierter Import: Geht zwei Ebenen hoch zu 'features/voice'
import { useVoice } from '../..'; 
// Korrigierter Import: Geht vier Ebenen hoch zu 'src/context/SettingsContext'
import { useSettings } from '../../../../context/SettingsContext';

type VoicePreJoinProps = {
  channel: { id: number; name: string };
  onJoin: () => Promise<void> | void;
  onCancel: () => void;
  isJoining?: boolean;
  connectedChannelName?: string | null;
  connectedElsewhere?: boolean;
};

export const VoicePreJoin = ({
  channel,
  onJoin,
  onCancel,
  isJoining,
  connectedChannelName,
  connectedElsewhere,
}: VoicePreJoinProps) => {
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
  
  const { settings, updateDevices, updateTalk } = useSettings();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [volumePercent, setVolumePercent] = useState(Math.round((outputVolume ?? 1) * 100));
  const [submitting, setSubmitting] = useState(false);
  
  const [dontShowAgain, setDontShowAgain] = useState(false);

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

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

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
      if (dontShowAgain) {
        updateTalk({ showVoicePreJoin: false });
      }
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

  const infoText =
    connectedElsewhere && connectedChannelName
      ? `Du bist aktuell mit "${connectedChannelName}" verbunden. Ein Beitritt wechselt den Kanal.`
      : 'Bitte prüfe deine Geräte-Einstellungen vor dem Beitritt.';

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col relative font-sans overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
      {/* Background Decor */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 15%, var(--color-accent), transparent 40%), radial-gradient(circle at 85% 85%, var(--color-surface-alt), transparent 40%)',
        }}
      />

      {/* Main Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full overscroll-contain">
        <div className="min-h-full flex flex-col p-4 md:p-8 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 relative z-10 my-auto mx-auto min-h-0">
            
            {/* LEFT COLUMN: Controls */}
            <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-3xl shadow-2xl p-5 md:p-8 backdrop-blur-xl flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              {/* Header Area */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4 md:pb-6">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-accent)] font-bold mb-1">
                    Voice Check
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2 flex-wrap">
                    <span className="truncate max-w-full md:max-w-md">{channel.name}</span>
                    <ChevronRight className="text-[var(--color-text-muted)] hidden md:block shrink-0" size={20} />
                    <span className="text-sm font-medium text-[var(--color-text-muted)] hidden md:block shrink-0">
                      Eingangshalle
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-medium">
                    {isJoining || connectionState === 'connecting' ? (
                      <Loader2 size={12} className="animate-spin text-[var(--color-accent)] shrink-0" />
                    ) : (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    )}
                    <span className="text-[var(--color-text-muted)] truncate">{connectionLabel}</span>
                  </div>
                </div>

                <button
                  onClick={refreshDevices}
                  disabled={loadingDevices}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-surface-alt)] hover:bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)] border border-[var(--color-border)] transition-all hover:border-[var(--color-border-strong)] active:scale-95 w-full md:w-auto shrink-0"
                >
                  <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} />
                  <span>Geräte neu laden</span>
                </button>
              </div>

              {/* Device Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                
                {/* 1. Microphone */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    micMuted
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-[var(--color-surface-alt)] border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                      <Mic
                        size={16}
                        className={micMuted ? 'text-red-400' : 'text-[var(--color-accent)]'}
                      />
                      Mikrofon
                    </div>
                    <button
                      onClick={() => setMicMuted(!micMuted)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wide border transition-all shrink-0 ${
                        micMuted
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'
                      }`}
                    >
                      {micMuted ? 'Stumm' : 'Live'}
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedAudioInputId || ''}
                      onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                      className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] appearance-none transition-colors pr-8"
                    >
                      <option value="">Standard Mikrofon</option>
                      {audioInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Unbenanntes Mikrofon'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-[var(--color-text-muted)]">
                      <Settings size={12} />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                    <span>Push-to-Talk</span>
                    <button
                      onClick={() => setPushToTalk(!usePushToTalk)}
                      className={`px-2 py-1 rounded transition-colors ${
                        usePushToTalk
                          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {usePushToTalk ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>
                </div>

                {/* 2. Output / Speaker */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    muted
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-[var(--color-surface-alt)] border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                      <Headphones
                        size={16}
                        className={muted ? 'text-red-400' : 'text-[var(--color-accent)]'}
                      />
                      Ausgabe
                    </div>
                    <button
                      onClick={() => setMuted(!muted)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wide border transition-all shrink-0 ${
                        muted
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      {muted ? 'Stumm' : 'Hörbar'}
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <select
                      value={selectedAudioOutputId || ''}
                      onChange={(e) => handleDeviceChange('audiooutput', e.target.value)}
                      className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] appearance-none transition-colors pr-8"
                    >
                      <option value="">Systemausgabe</option>
                      {audioOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Lautsprecher'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-[var(--color-text-muted)]">
                      <Settings size={12} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleVolumeChange(0)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <VolumeX size={14} />
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={volumePercent}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-[var(--color-surface-hover)] rounded-full appearance-none accent-[var(--color-accent)] cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-[var(--color-accent)] w-8 text-right">
                      {volumePercent}%
                    </span>
                  </div>
                </div>

                {/* 3. Camera */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                      <Video size={16} className="text-purple-400" />
                      Kamera
                    </div>
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold bg-[var(--color-background)] px-2 py-1 rounded shrink-0">
                      Optional
                    </span>
                  </div>
                  <div className="relative mb-2">
                    <select
                      value={selectedVideoInputId || ''}
                      onChange={(e) => handleDeviceChange('videoinput', e.target.value)}
                      className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 appearance-none transition-colors pr-8"
                    >
                      <option value="">Keine Kamera</option>
                      {videoInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Kamera'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-[var(--color-text-muted)]">
                      <Settings size={12} />
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                    Die Kamera ist beim Beitritt standardmäßig deaktiviert, kann aber im Channel jederzeit eingeschaltet werden.
                  </div>
                </div>

                {/* 4. Info Card */}
                <div className="p-4 rounded-2xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10 flex flex-col justify-center">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0">
                      <Info size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--color-text)] mb-1">Hinweis</div>
                      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{infoText}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Error Banner */}
              {(error || localError) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="p-1.5 bg-red-500/20 rounded-full text-red-400 shrink-0">
                    <MicOff size={14} />
                  </div>
                  <span className="text-xs text-red-200 font-medium">{error || localError}</span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Summary & Join (Sticky on Desktop) */}
            <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 backdrop-blur-xl h-fit lg:sticky lg:top-8 animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-[var(--color-accent)]/20 shrink-0">
                  {channel.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                    Beitreten in
                  </div>
                  <div className="text-lg font-bold text-[var(--color-text)] truncate" title={channel.name}>
                    {channel.name}
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-surface-alt)] rounded-2xl p-4 space-y-3 border border-[var(--color-border)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      connectionState === 'connected'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {connectionState === 'connected' ? 'Verbunden' : 'Warte...'}
                  </span>
                </div>
                <div className="h-px bg-[var(--color-border)]" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Mic size={12} /> Mikrofon
                  </span>
                  <span
                    className={
                      micMuted ? 'text-red-400 font-medium' : 'text-[var(--color-text)]'
                    }
                  >
                    {micMuted ? 'Stumm' : 'Aktiv'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Headphones size={12} /> Sound
                  </span>
                  <span
                    className={
                      muted ? 'text-red-400 font-medium' : 'text-[var(--color-text)]'
                    }
                  >
                    {muted ? 'Aus' : `${volumePercent}%`}
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-2">
                
                {/* Checkbox "Nicht mehr anzeigen" */}
                <div className="flex items-center gap-2 px-1">
                  <input
                    id="dont-show-again"
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0 cursor-pointer"
                  />
                  <label 
                    htmlFor="dont-show-again" 
                    className="text-xs text-[var(--color-text-muted)] cursor-pointer select-none"
                  >
                    Diesen Dialog nicht mehr anzeigen
                  </label>
                </div>

                <button
                  onClick={handleJoin}
                  disabled={isJoining || submitting}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-sm shadow-xl shadow-[var(--color-accent)]/20 hover:shadow-[var(--color-accent)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(isJoining || submitting) && <Loader2 size={16} className="animate-spin" />}
                  {isJoining || submitting ? 'Verbinde...' : 'Jetzt beitreten'}
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-3 rounded-xl bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] font-semibold text-xs transition-colors"
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