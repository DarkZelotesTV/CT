import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Headphones, Mic, Play, Settings, Volume2, X } from 'lucide-react';

import { useSettings } from '../../context/SettingsContext';
import { useVoice } from '../../context/voice-state';

const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

type DeviceLists = {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
};

const HotkeyInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') return;
    e.preventDefault();

    if (e.key === 'Backspace' || e.key === 'Escape') {
      onChange('');
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
    }

    onChange(parts.join('+'));
  };

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center justify-between">
        <span>{label}</span>
        {value && <span className="text-[10px] text-cyan-400">Backspace/Esc löschen</span>}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={value}
          onKeyDown={handleKeyDown}
          readOnly
          placeholder="Taste drücken"
          className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export const TalkSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { settings, updateDevices, updateHotkeys } = useSettings();
  const {
    muted,
    usePushToTalk,
    setMuted,
    setPushToTalk,
    selectedAudioInputId,
    selectedAudioOutputId,
  } = useVoice();

  const [deviceLists, setDeviceLists] = useState<DeviceLists>({ audioInputs: [], audioOutputs: [] });
  const [audioInputId, setAudioInputId] = useState(selectedAudioInputId || '');
  const [audioOutputId, setAudioOutputId] = useState(selectedAudioOutputId || '');
  const [pushToTalkKey, setPushToTalkKey] = useState(settings.hotkeys.pushToTalk || '');
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(usePushToTalk);
  const [locallyMuted, setLocallyMuted] = useState(muted);
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(1);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [isTestingOutput, setIsTestingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceLists({
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
      });
    } catch (err: any) {
      console.warn('Device enumeration failed', err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let frame: number | null = null;
    let smoothedLevel = 0;
    let lastUpdate = 0;
    const run = async () => {
      try {
        setMeterError(null);
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: audioInputId || undefined } });
        audioContext = new AudioContext();
        sourceNode = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        sourceNode.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const smoothing = 0.2;
        const minInterval = 75; // throttle UI updates
        const tick = (time: number) => {
          if (!analyser) return;
          if (time - lastUpdate < minInterval) {
            frame = requestAnimationFrame(tick);
            return;
          }
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const value = data[i] - 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / data.length) / 128;
          const level = Math.min(1, rms * 2 * sensitivity);
          smoothedLevel = smoothedLevel + (level - smoothedLevel) * smoothing;
          setInputLevel(smoothedLevel);
          lastUpdate = time;
          frame = requestAnimationFrame(tick);
        };
        tick(performance.now());
      } catch (err: any) {
        setMeterError(err?.message || 'Pegel konnte nicht gemessen werden.');
        setInputLevel(0);
      }
    };

    run();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      sourceNode?.disconnect();
      analyser?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      if (audioContext) audioContext.close();
    };
  }, [audioInputId, sensitivity]);

  const levelPercent = useMemo(() => Math.round(inputLevel * 100), [inputLevel]);

  const handleTestOutput = useCallback(async () => {
    setIsTestingOutput(true);
    setOutputError(null);
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const destination = ctx.createMediaStreamDestination();
      gain.gain.value = 0.1;
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      oscillator.connect(gain).connect(destination);
      const audio = new Audio();
      audio.srcObject = destination.stream as any;
      if ('setSinkId' in audio && audioOutputId) {
        await (audio as any).setSinkId(audioOutputId);
      }
      oscillator.start();
      await ctx.resume();
      await audio.play();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
        setIsTestingOutput(false);
      }, 1200);
    } catch (err: any) {
      console.error('Output test failed', err);
      setOutputError(err?.message || 'Ausgabe konnte nicht getestet werden.');
      setIsTestingOutput(false);
    }
  }, [audioOutputId]);

  const handleSave = async () => {
    updateDevices({ audioInputId: audioInputId || null, audioOutputId: audioOutputId || null });
    updateHotkeys({ pushToTalk: pushToTalkKey || null });
    await setPushToTalk(pushToTalkEnabled);
    await setMuted(locallyMuted);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="w-full max-w-3xl bg-[#0d0f15] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Settings size={20} />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Talk Settings</div>
              <div className="text-xs text-gray-400">Mikrofon, Lautsprecher und Push-to-Talk konfigurieren.</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          <section className="space-y-4">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Geräte</div>
            <div className="space-y-3">
              <label className="space-y-2">
                <div className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-2">
                  <Mic size={14} /> Mikrofon
                </div>
                <select
                  value={audioInputId}
                  onChange={(e) => setAudioInputId(e.target.value)}
                  className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  <option value="">System-Standard</option>
                  {deviceLists.audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || 'Unbenanntes Mikrofon'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <div className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-2">
                  <Headphones size={14} /> Lautsprecher
                </div>
                <select
                  value={audioOutputId}
                  onChange={(e) => setAudioOutputId(e.target.value)}
                  className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  <option value="">System-Standard</option>
                  {deviceLists.audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || 'Unbenannter Ausgang'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                <Volume2 size={14} /> Eingangspegel
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <div className="text-[11px] text-gray-400 w-24 text-right">
                  Empfindlichkeit: {sensitivity.toFixed(1)}x
                </div>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all"
                  style={{ width: `${levelPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className={meterError ? 'text-red-400' : ''}>
                  {meterError || 'Sprich, um den Pegel zu prüfen.'}
                </span>
                <span className="text-cyan-400 font-semibold">{levelPercent}%</span>
              </div>
              <div className="text-[11px] text-gray-400">
                Passt die Empfindlichkeit an, bis Umgebungsgeräusche im grünen Bereich bleiben.
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Audio-Test & Hotkeys</div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Ausgabe testen</div>
                  <p className="text-xs text-gray-400">Spiele einen kurzen Ton über den gewählten Lautsprecher ab.</p>
                </div>
                <button
                  onClick={handleTestOutput}
                  disabled={isTestingOutput}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-2"
                >
                  <Play size={16} /> {isTestingOutput ? 'Test läuft' : 'Testton'}
                </button>
              </div>
              {outputError && <div className="text-xs text-red-400">{outputError}</div>}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">Push-to-Talk</div>
                  <p className="text-xs text-gray-400">Wenn aktiviert, bleibt dein Mikro stumm bis du die Hotkey-Kombination hältst.</p>
                </div>
                <button
                  onClick={() => setPushToTalkEnabled((v) => !v)}
                  className={`px-4 py-2 rounded-xl border ${pushToTalkEnabled ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-gray-300 hover:text-white hover:border-white/30'}`}
                >
                  {pushToTalkEnabled ? 'Aktiv' : 'Aus'}
                </button>
              </div>
              <HotkeyInput label="Push-to-Talk Hotkey" value={pushToTalkKey} onChange={setPushToTalkKey} />

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">Mikrofon</div>
                  <p className="text-xs text-gray-400">Schalte dein Mikrofon dauerhaft stumm oder frei.</p>
                </div>
                <button
                  onClick={() => setLocallyMuted((v) => !v)}
                  className={`px-4 py-2 rounded-xl border ${locallyMuted ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-green-400 bg-green-500/20 text-green-100'}`}
                >
                  {locallyMuted ? 'Stumm' : 'Aktiv'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Check size={14} className="text-green-400" /> Einstellungen werden lokal gespeichert.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2"
            >
              <Settings size={16} />
              Anwenden
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
