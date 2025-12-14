import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Check,
  Download,
  Headphones,
  Keyboard,
  Mic,
  Play,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useVoice } from '../../context/voice-state';
import { clearIdentity, computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from '../../auth/identity';
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from '../../auth/identityBackup';

const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

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
        {value && <span className="text-[10px] text-cyan-400">Press Backspace/Esc to clear</span>}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={value}
          onKeyDown={handleKeyDown}
          readOnly
          placeholder="Press keys"
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

type DeviceLists = {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
};

export const UserSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { settings, updateDevices, updateHotkeys, updateProfile } = useSettings();
  const {
    muted,
    setMuted,
    usePushToTalk,
    setPushToTalk: setPushToTalkEnabledFlag,
    selectedAudioInputId,
    selectedAudioOutputId,
  } = useVoice();
  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [avatarUrl, setAvatarUrl] = useState(settings.profile.avatarUrl);
  const [audioInputId, setAudioInputId] = useState(settings.devices.audioInputId || selectedAudioInputId || '');
  const [audioOutputId, setAudioOutputId] = useState(settings.devices.audioOutputId || selectedAudioOutputId || '');
  const [videoInputId, setVideoInputId] = useState(settings.devices.videoInputId || '');
  const [pushToTalk, setPushToTalkHotkey] = useState(settings.hotkeys.pushToTalk || '');
  const [muteToggle, setMuteToggle] = useState(settings.hotkeys.muteToggle || '');
  const [deviceLists, setDeviceLists] = useState<DeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(usePushToTalk);
  const [locallyMuted, setLocallyMuted] = useState(muted);
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(1);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [isTestingOutput, setIsTestingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [identityName, setIdentityName] = useState(identity?.displayName ?? '');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      { id: 'profile', label: 'Profil', icon: Settings },
      { id: 'devices', label: 'Audio & Video', icon: Camera },
      { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
      { id: 'talk', label: 'Talk & Audio', icon: Volume2 },
      { id: 'identity', label: 'Identity', icon: ShieldAlert },
    ],
    []
  );
  const sectionRefs = useMemo(() => {
    return categories.reduce<Record<string, RefObject<HTMLElement>>>((acc, cat) => {
      acc[cat.id] = useRef<HTMLElement>(null);
      return acc;
    }, {});
  }, [categories]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? '');

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceError('Dein Browser unterstützt keine Geräteauswahl.');
      return;
    }

    try {
      setDeviceError(null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceLists({
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
        videoInputs: devices.filter((d) => d.kind === 'videoinput'),
      });
    } catch (err: any) {
      setDeviceError(err?.message || 'Geräte konnten nicht geladen werden.');
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
        const minInterval = 75;
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

  const avatarPreview = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    if (settings.profile.avatarUrl) return settings.profile.avatarUrl;
    return '';
  }, [avatarUrl, settings.profile.avatarUrl]);

  const levelPercent = useMemo(() => Math.round(inputLevel * 100), [inputLevel]);
  const fingerprint = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

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
      setOutputError(err?.message || 'Ausgabe konnte nicht getestet werden.');
      setIsTestingOutput(false);
    }
  }, [audioOutputId]);

  const persistIdentity = (nextIdentity: IdentityFile | null) => {
    if (nextIdentity) saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
  };

  const handleCreateIdentity = async () => {
    setIdentityError(null);
    try {
      const id = await createIdentity(identityName || undefined);
      persistIdentity(id);
    } catch (e: any) {
      setIdentityError(e?.message ?? 'Identity konnte nicht erstellt werden');
    }
  };

  const handleExportIdentity = () => {
    if (!identity) return;
    const pass = backupPassphrase.trim();
    const doExport = async () => {
      const payload = await buildBackupPayload(identity, pass);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getBackupFilename(!!pass);
      a.click();
      URL.revokeObjectURL(url);
    };
    void doExport();
  };

  const handleImportIdentity = async (file: File) => {
    setIdentityError(null);
    try {
      const text = await file.text();
      const parsed = await parseIdentityBackup(text, () => window.prompt('Passphrase für dieses Backup?'));
      const trimmed = (identityName ?? '').trim();
      const next = { ...parsed, displayName: parsed.displayName ?? (trimmed ? trimmed : undefined) };
      persistIdentity(next);
      setIdentityName(next.displayName ?? '');
    } catch (e: any) {
      setIdentityError(e?.message ?? 'Import fehlgeschlagen');
    }
  };

  const handleResetIdentity = () => {
    clearIdentity();
    localStorage.removeItem('clover_token');
    localStorage.removeItem('clover_user');
    localStorage.removeItem('ct.jwt');
    localStorage.removeItem('clover_server_password');
    setIdentityName('');
    persistIdentity(null);
  };

  const handleSaveIdentityName = () => {
    if (!identity) return;
    const updated: IdentityFile = { ...identity, displayName: identityName || undefined };
    persistIdentity(updated);
  };

  const handleSave = async () => {
    updateProfile({ displayName, avatarUrl });
    updateDevices({
      audioInputId: audioInputId || null,
      audioOutputId: audioOutputId || null,
      videoInputId: videoInputId || null,
    });
    updateHotkeys({
      pushToTalk: pushToTalk || null,
      muteToggle: muteToggle || null,
    });
    await setPushToTalkEnabledFlag(pushToTalkEnabled);
    await setMuted(locallyMuted);
    onClose();
  };

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let closestId = activeCategory;
    let closestDistance = Number.POSITIVE_INFINITY;

    categories.forEach((cat) => {
      const el = sectionRefs[cat.id]?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerTop - 16);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = cat.id;
      }
    });

    if (closestId !== activeCategory) {
      setActiveCategory(closestId);
    }
  }, [activeCategory, categories, sectionRefs]);

  const scrollToCategory = useCallback(
    (id: string) => {
      const container = containerRef.current;
      const el = sectionRefs[id]?.current;
      if (!container || !el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const nextTop = elRect.top - containerRect.top + container.scrollTop - 12;
      container.scrollTo({ top: nextTop, behavior: 'smooth' });
      setActiveCategory(id);
    },
    [sectionRefs]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => handleScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1014] w-full max-w-4xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Settings size={14} /> Settings
            </div>
            <h2 className="text-2xl font-bold text-white">Persönliche Einstellungen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 max-h-[75vh]">
          <div className="grid md:grid-cols-[200px,1fr] gap-6 h-full">
            <nav className="bg-white/5 border border-white/10 rounded-2xl p-3 flex md:flex-col gap-2 md:sticky md:top-4 h-fit">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition border ${
                    activeCategory === cat.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                      : 'border-transparent text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <cat.icon size={16} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            <div ref={containerRef} className="space-y-6 overflow-y-auto pr-1">
              <section ref={sectionRefs.profile} id="profile" className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Profil</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-semibold">Anzeigename</label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Dein Name"
                        className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-semibold">Avatar-URL</label>
                      <input
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 bg-white/5 rounded-2xl border border-white/10 p-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-cyan-900/40 border border-cyan-600/40 flex items-center justify-center text-cyan-300 font-bold text-xl">
                    {avatarPreview ? (
                      <img src={avatarPreview} className="w-full h-full object-cover" />
                    ) : (
                      (displayName || settings.profile.displayName || 'CT').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="text-xs text-gray-400 text-center">Vorschau</div>
                </div>
              </section>

              <section ref={sectionRefs.devices} id="devices" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Audio & Video</div>
                <p className="text-gray-400 text-sm">Wähle deine bevorzugten Ein- und Ausgabegeräte.</p>
              </div>
              <button
                onClick={refreshDevices}
                className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw size={16} />
                Geräte aktualisieren
              </button>
            </div>
            {deviceError && <div className="text-red-400 text-sm">{deviceError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <label className="space-y-2">
                <div className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-2">
                  <Camera size={14} /> Kamera
                </div>
                <select
                  value={videoInputId}
                  onChange={(e) => setVideoInputId(e.target.value)}
                  className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  <option value="">System-Standard</option>
                  {deviceLists.videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || 'Unbenannte Kamera'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section ref={sectionRefs.hotkeys} id="hotkeys" className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Hotkeys</div>
            <p className="text-gray-400 text-sm">Lege Tasten für Push-to-Talk oder schnelles Muten fest.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HotkeyInput label="Push-to-Talk" value={pushToTalk} onChange={setPushToTalkHotkey} />
              <HotkeyInput label="Mute Toggle" value={muteToggle} onChange={setMuteToggle} />
            </div>
          </section>

          <section ref={sectionRefs.talk} id="talk" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Talk & Audio-Steuerung</div>
                <p className="text-gray-400 text-sm">Passe Stummschaltung, Push-to-Talk und Ausgangstest an.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 rounded-2xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                    <Volume2 size={14} /> Eingangspegel
                  </div>
                  <span className="text-cyan-400 text-xs font-semibold">{levelPercent}%</span>
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
                  <div className="text-[11px] text-gray-400 w-24 text-right">Empfindlichkeit: {sensitivity.toFixed(1)}x</div>
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
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-sm font-semibold text-white">Push-to-Talk</div>
                    <p className="text-xs text-gray-400">Wenn aktiv, sendest du nur während der Tastenkombination.</p>
                  </div>
                  <button
                    onClick={() => setPushToTalkEnabled((v) => !v)}
                    className={`px-4 py-2 rounded-xl border ${pushToTalkEnabled ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-gray-300 hover:text-white hover:border-white/30'}`}
                  >
                    {pushToTalkEnabled ? 'Aktiv' : 'Aus'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-sm font-semibold text-white">Gesamt-Stummschaltung</div>
                    <p className="text-xs text-gray-400">Schalte dein Mikrofon dauerhaft stumm oder frei.</p>
                  </div>
                  <button
                    onClick={() => setLocallyMuted((v) => !v)}
                    className={`px-4 py-2 rounded-xl border ${locallyMuted ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-green-400 bg-green-500/20 text-green-100'}`}
                  >
                    {locallyMuted ? 'Stumm' : 'Aktiv'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-2">
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
              </div>
            </div>
          </section>

          <section ref={sectionRefs.identity} id="identity" className="space-y-4">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Identity</div>
            <p className="text-gray-400 text-sm">Verwalte deine lokale Clover Identity direkt aus den Einstellungen.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-bold text-gray-400 block">Anzeigename (optional)</label>
                <input
                  type="text"
                  value={identityName}
                  onChange={(e) => setIdentityName(e.target.value)}
                  placeholder="z.B. jusbe"
                  className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <button
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                  onClick={handleSaveIdentityName}
                  disabled={!identity}
                >
                  Anzeigename speichern
                </button>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-gray-400 text-sm">Fingerprint</div>
                <div className="font-mono break-all text-gray-200 text-xs">
                  {fingerprint ? formatFingerprint(fingerprint) : '–'}
                </div>
              </div>
            </div>

            {!identity ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-white font-medium"
                  onClick={handleCreateIdentity}
                >
                  Identity erstellen
                </button>

                <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer text-center text-white font-medium">
                  <div className="flex items-center justify-center gap-2">
                    <Upload size={18} />
                    <span>Identity importieren</span>
                  </div>
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportIdentity(f);
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-sm bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="text-gray-400 mb-1">Erstellt</div>
                    <div className="text-gray-200">{identity.createdAt ? new Date(identity.createdAt).toLocaleString() : '–'}</div>
                  </div>

                  <div className="text-sm bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="text-gray-400 mb-1">Public Key</div>
                    <div className="font-mono break-all text-gray-200 text-xs">{identity.publicKeyB64}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Backup-Passphrase (optional)</label>
                  <input
                    type="password"
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="Leer lassen für Klartext-Export"
                    className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Wenn gesetzt, wird dein Backup AES-GCM verschlüsselt (PBKDF2).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition text-white font-medium flex items-center justify-center gap-2"
                    onClick={handleExportIdentity}
                  >
                    <Download size={18} />
                    Export / Backup
                  </button>

                  <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer text-center text-white font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <Upload size={18} />
                      <span>Import (ersetzen)</span>
                    </div>
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportIdentity(f);
                      }}
                    />
                  </label>

                  <button
                    className="px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition text-red-100 font-medium flex items-center justify-center gap-2 sm:col-span-2"
                    onClick={handleResetIdentity}
                  >
                    <ShieldAlert size={18} />
                    Identity zurücksetzen
                  </button>
                </div>
              </div>
            )}

            {identityError && <div className="text-red-400 text-sm">{identityError}</div>}
          </section>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Check size={14} className="text-green-400" />
            Änderungen werden lokal gespeichert.
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
              <Save size={16} />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
