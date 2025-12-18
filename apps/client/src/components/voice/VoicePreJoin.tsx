import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Headphones, Info, Loader2, Mic, MicOff, RefreshCw, Settings, Volume2, VolumeX, Video } from 'lucide-react';
import { useVoice } from '../../context/voice-state';
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

  const selectedAudioInput = audioInputs.find((d) => d.deviceId === selectedAudioInputId)?.label;
  const selectedAudioOutput = audioOutputs.find((d) => d.deviceId === selectedAudioOutputId)?.label;
  const selectedVideoInput = videoInputs.find((d) => d.deviceId === selectedVideoInputId)?.label;

  const infoText = connectedElsewhere && connectedChannelName
    ? `Du bist aktuell mit "${connectedChannelName}" verbunden. Ein Beitritt wechselt den Kanal.`
    : 'Stelle sicher, dass die richtigen Geräte ausgewählt sind, bevor du beitrittst.';

  return (
    <div className="flex-1 bg-gradient-to-br from-[#0b0c10] via-[#0d0f15] to-[#0b0c10] flex items-center justify-center p-6 md:p-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.08), transparent 25%), radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.08), transparent 20%)',
      }} />
      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="bg-[#0f1117]/90 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold">Voice Check</div>
              <div className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="truncate">{channel.name}</span>
                <ChevronRight className="text-gray-600" size={18} />
                <span className="text-sm text-gray-400">Vor dem Beitritt</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                {isJoining || connectionState === 'connecting' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                <span className="text-gray-300">{connectionLabel}</span>
              </div>
            </div>
            <button
              onClick={refreshDevices}
              disabled={loadingDevices}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 border border-white/10 transition-colors"
            >
              <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} />
              Geräte aktualisieren
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><Mic size={16} /> Mikrofon</div>
                <button
                  onClick={() => setMicMuted(!micMuted)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${micMuted ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                >
                  {micMuted ? 'Stumm' : 'Live'}
                </button>
              </div>
              <select
                value={selectedAudioInputId || ''}
                onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Standard Mikrofon</option>
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Mikrofon'}</option>
                ))}
              </select>
              <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                <Info size={12} />
                Push-to-Talk {usePushToTalk ? 'aktiviert' : 'deaktiviert'}
                <button
                  onClick={() => setPushToTalk(!usePushToTalk)}
                  className="ml-auto px-2 py-1 rounded-md text-[11px] border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                >
                  Umschalten
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><Headphones size={16} /> Ausgabe</div>
                <button
                  onClick={() => setMuted(!muted)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${muted ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                >
                  {muted ? 'Deafened' : 'Hörbar'}
                </button>
              </div>
              <select
                value={selectedAudioOutputId || ''}
                onChange={(e) => handleDeviceChange('audiooutput', e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Systemausgabe</option>
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Lautsprecher'}</option>
                ))}
              </select>

              <label className="mt-3 block">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Output-Lautstärke</span>
                  <span className="flex items-center gap-1 text-gray-300 font-semibold">
                    {volumePercent === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {volumePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={volumePercent}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full mt-2 accent-indigo-400"
                />
              </label>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><Video size={16} /> Kamera</div>
                <span className="text-[11px] text-gray-500">Optional</span>
              </div>
              <select
                value={selectedVideoInputId || ''}
                onChange={(e) => handleDeviceChange('videoinput', e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Keine Kamera</option>
                {videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>
                ))}
              </select>
              <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                <Settings size={12} />
                Kamera kann nach dem Beitritt aktiviert werden.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Info size={16} /> Verbindung & Status
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{connectionLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Mic size={14} className="text-gray-500" />
                  <span>{micMuted ? 'Mikrofon stumm' : 'Mikrofon aktiv'} · {selectedAudioInput || 'Standard Gerät'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Headphones size={14} className="text-gray-500" />
                  <span>{muted ? 'Audioausgabe deaktiviert' : 'Audioausgabe aktiv'} · {selectedAudioOutput || 'Standard Gerät'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Video size={14} className="text-gray-500" />
                  <span>{selectedVideoInput || 'Keine Kamera ausgewählt'}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 bg-white/[0.03] border border-white/5 rounded-lg p-3">
                {infoText}
              </div>
            </div>
          </div>

          {(error || localError) && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <MicOff size={16} />
              <span className="truncate">{error || localError}</span>
            </div>
          )}
        </div>

        <div className="bg-[#0f1117]/80 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-7 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-200 font-bold">
              {channel.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Channel</div>
              <div className="text-lg font-bold text-white leading-tight">{channel.name}</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm text-gray-300">
            <div className="flex items-center justify-between">
              <span>Mic Status</span>
              <span className="font-semibold">{micMuted ? 'Stumm' : 'Aktiv'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ausgabe</span>
              <span className="font-semibold">{muted ? 'Deaktiviert' : 'Aktiv'} ({volumePercent}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Push-to-Talk</span>
              <span className="font-semibold">{usePushToTalk ? 'An' : 'Aus'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Geräte</span>
              <span className="font-semibold">{audioInputs.length + audioOutputs.length + videoInputs.length || 'Keine erkannt'}</span>
            </div>
          </div>

          <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onCancel}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 font-semibold transition-colors"
              type="button"
            >
              Abbrechen
            </button>
            <button
              onClick={handleJoin}
              disabled={isJoining || submitting}
              className="w-full px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
              type="button"
            >
              {(isJoining || submitting) && <Loader2 size={16} className="animate-spin" />}
              {isJoining || submitting ? 'Verbinden...' : 'Dem Talk beitreten'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
