import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from './modalRoot';
import { useTopBar } from '../window/TopBarContext';
import {
  Camera,
  Check,
  Download,
  Headphones,
  Keyboard,
  Palette,
  Mic,
  Play,
  RefreshCw,
  Save,
  SunMoon,
  Settings,
  ShieldAlert,
  Bell,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { defaultHotkeySettings, useSettings } from '../../context/SettingsContext';
import { useVoice } from '../../features/voice';
import { clearIdentity, computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from '../../auth/identity';
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from '../../auth/identityBackup';
import { storage } from '../../shared/config/storage';

const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

const HotkeyInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string) => void;
}) => {
  const displayValue = value ?? '';
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
        {displayValue && <span className="text-[10px] text-cyan-400">Press Backspace/Esc to clear</span>}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={displayValue}
          onKeyDown={handleKeyDown}
          readOnly
          placeholder="Press keys"
          className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        />
        {displayValue && (
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
  const { slots, setSlots } = useTopBar();
  const baseSlotsRef = useRef(slots);
  const modalTitle = 'Persönliche Einstellungen';

  useEffect(() => {
    const base = baseSlotsRef.current;
    setSlots({
      ...base,
      center: (
        <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 max-w-[720px]">
          <div className="text-[13px] text-gray-200 truncate" title={modalTitle}>
            {modalTitle}
          </div>
        </div>
      ),
    });

    return () => setSlots(base);
  }, [setSlots, modalTitle]);

  const { settings, updateDevices, updateHotkeys, updateProfile, updateTheme, updateNotifications } = useSettings();
  const {
    muted,
    micMuted,
    setMuted,
    setMicMuted,
    usePushToTalk,
    setPushToTalk: setPushToTalkEnabledFlag,
    rnnoiseEnabled,
    rnnoiseAvailable,
    rnnoiseError,
    setRnnoiseEnabled: setRnnoiseEnabledFlag,
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
  const [commandPaletteHotkey, setCommandPaletteHotkey] = useState(
    settings.hotkeys.commandPalette ?? defaultHotkeySettings.commandPalette
  );
  const [notificationPermission, setNotificationPermission] = useState(settings.notifications.permission);
  const [notifyMentions, setNotifyMentions] = useState(settings.notifications.mentions);
  const [notifyDirectMessages, setNotifyDirectMessages] = useState(settings.notifications.directMessages);
  const [notifyInvites, setNotifyInvites] = useState(settings.notifications.invites);
  const [toggleMembersHotkey, setToggleMembersHotkey] = useState(
    settings.hotkeys.toggleMembers ?? defaultHotkeySettings.toggleMembers
  );
  const [toggleNavigationHotkey, setToggleNavigationHotkey] = useState(
    settings.hotkeys.toggleNavigation ?? defaultHotkeySettings.toggleNavigation
  );
  const [skipToContentHotkey, setSkipToContentHotkey] = useState(
    settings.hotkeys.skipToContent ?? defaultHotkeySettings.skipToContent
  );
  const [deviceLists, setDeviceLists] = useState<DeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(usePushToTalk);
  const [locallyMuted, setLocallyMuted] = useState(muted);
  const [locallyMicMuted, setLocallyMicMuted] = useState(micMuted);
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(1);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [isTestingOutput, setIsTestingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [useRnnoise, setUseRnnoise] = useState(rnnoiseEnabled);
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [identityName, setIdentityName] = useState(identity?.displayName ?? '');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState(settings.theme.mode);
  const [accentColor, setAccentColor] = useState(settings.theme.accentColor);
  const [serverAccentDraft, setServerAccentDraft] = useState<Record<number, string>>(settings.theme.serverAccents || {});
  const [serverAccentTarget, setServerAccentTarget] = useState('');
  const [serverAccentColor, setServerAccentColor] = useState(settings.theme.accentColor);

  // 'Talk & Audio' wurde in 'devices' integriert und entfernt
  const categories = useMemo(
    () => [
      { id: 'profile', label: 'Profil', icon: Settings },
      { id: 'appearance', label: 'Design', icon: Palette },
      { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
      { id: 'devices', label: 'Audio & Video', icon: Camera },
      { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
      { id: 'identity', label: 'Identity', icon: ShieldAlert },
    ],
    []
  );

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
    setUseRnnoise(rnnoiseEnabled);
  }, [rnnoiseEnabled]);

  useEffect(() => {
    setNotificationPermission(settings.notifications.permission);
    setNotifyMentions(settings.notifications.mentions);
    setNotifyDirectMessages(settings.notifications.directMessages);
    setNotifyInvites(settings.notifications.invites);
  }, [settings.notifications]);

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
        const audioConstraints: MediaTrackConstraints | boolean = audioInputId ? { deviceId: audioInputId } : true;
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
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
          for (const dataPoint of data) {
            const value = dataPoint - 128;
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
  const permissionLabel = useMemo(() => {
    if (notificationPermission === 'granted') return 'Aktiv';
    if (notificationPermission === 'denied') return 'Blockiert';
    if (notificationPermission === 'unsupported') return 'Nicht unterstützt';
    return 'Unbestätigt';
  }, [notificationPermission]);

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

  const resolvedIdentityName = identityName.trim();

  const handleCreateIdentity = async () => {
    setIdentityError(null);
    try {
      const id = await createIdentity(resolvedIdentityName);
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
      const parsed = await parseIdentityBackup(text, () => window.prompt('Passphrase für dieses Backup?') ?? '');
      const next: IdentityFile = { ...parsed, displayName: parsed.displayName ?? (resolvedIdentityName || null) };
      persistIdentity(next);
      setIdentityName(next.displayName ?? '');
    } catch (e: any) {
      setIdentityError(e?.message ?? 'Import fehlgeschlagen');
    }
  };

  const handleResetIdentity = () => {
    clearIdentity();
    storage.remove('cloverToken');
    storage.remove('cloverUser');
    storage.remove('ctJwt');
    storage.remove('cloverServerPassword');
    setIdentityName('');
    persistIdentity(null);
  };

  const handleSaveIdentityName = () => {
    if (!identity) return;
    const updated: IdentityFile = { ...identity, displayName: resolvedIdentityName || null };
    persistIdentity(updated);
  };

  const handleAddServerAccent = () => {
    const parsedId = Number.parseInt(serverAccentTarget, 10);
    if (!Number.isFinite(parsedId)) return;
    setServerAccentDraft((prev) => ({ ...prev, [parsedId]: serverAccentColor }));
    setServerAccentTarget('');
  };

  const handleRemoveServerAccent = (id: number) => {
    setServerAccentDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRequestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      updateNotifications({ permission: 'unsupported' });
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    updateNotifications({ permission: result });
  }, [updateNotifications]);

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
      commandPalette: commandPaletteHotkey || null,
      toggleMembers: toggleMembersHotkey || null,
      toggleNavigation: toggleNavigationHotkey || null,
      skipToContent: skipToContentHotkey || null,
    });
    updateTheme({ mode: themeMode, accentColor, serverAccents: serverAccentDraft });
    updateNotifications({
      permission: notificationPermission,
      mentions: notifyMentions,
      directMessages: notifyDirectMessages,
      invites: notifyInvites,
    });
    await setPushToTalkEnabledFlag(pushToTalkEnabled);
    await setMuted(locallyMuted);
    await setMicMuted(locallyMicMuted);
    await setRnnoiseEnabledFlag(useRnnoise);
    onClose();
  };

	const target = getModalRoot();
	if (!target) return null;

	  return createPortal(
		  <div
		    className="fixed left-0 right-0 bottom-0 top-[var(--ct-titlebar-height)] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
		    style={{ zIndex: 9999, transform: 'translateZ(0)', willChange: 'transform' }}
		  >
      <div className="bg-[var(--color-surface)] w-11/12 max-w-5xl h-[85vh] rounded-3xl border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col text-[color:var(--color-text)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] flex items-center gap-2">
              <Settings size={14} /> Settings
            </div>
            <h2 className="text-2xl font-bold">{modalTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[var(--color-surface-alt)] hover:bg-[var(--color-surface-hover)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[240px,1fr] gap-0 h-full">
            <nav className="bg-[var(--color-surface-alt)] border-b md:border-b-0 md:border-r border-[var(--color-border)] p-3 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 md:shrink">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition border w-auto md:w-full whitespace-nowrap text-left flex-shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-[var(--color-accent)] bg-opacity-20 border-[var(--color-accent)] text-[color:var(--color-text)]'
                      : 'border-[var(--color-border)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  <cat.icon size={16} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-6 overflow-y-auto custom-scrollbar h-full">
              {activeCategory === 'profile' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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
                  </div>
                </div>
              )}

              {activeCategory === 'appearance' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Theme</div>
                      <p className="text-sm text-gray-400">Schalte zwischen Light/Dark um und passe die Farben an.</p>
                    </div>
                    <button
                      onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-[color:var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <SunMoon size={16} />
                      <span>{themeMode === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase font-bold text-gray-400 block">Akzentfarbe</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="h-10 w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="flex-1 bg-black/30 text-white p-3 rounded-xl border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase font-bold text-gray-400 block">Server Akzentfarbe</label>
                      <div className="grid grid-cols-[1fr,110px,auto] gap-2 items-center">
                        <input
                          type="number"
                          value={serverAccentTarget}
                          onChange={(e) => setServerAccentTarget(e.target.value)}
                          placeholder="Server ID"
                          className="bg-black/30 text-white p-3 rounded-xl border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
                        />
                        <input
                          type="color"
                          value={serverAccentColor}
                          onChange={(e) => setServerAccentColor(e.target.value)}
                          className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                        />
                        <button
                          onClick={handleAddServerAccent}
                          className="px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)]"
                        >
                          Speichern
                        </button>
                      </div>
                      <div className="space-y-2">
                        {Object.keys(serverAccentDraft).length === 0 ? (
                          <p className="text-sm text-gray-400">Keine server-spezifischen Farben hinterlegt.</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(serverAccentDraft).map(([id, color]) => (
                              <div
                                key={id}
                                className="flex items-center gap-3 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2"
                              >
                                <div className="w-10 h-10 rounded-lg border border-[var(--color-border)]" style={{ background: color }} />
                                <div className="flex-1 text-sm text-[color:var(--color-text)]">Server {id}</div>
                                <button
                                  onClick={() => handleRemoveServerAccent(Number(id))}
                                  className="text-xs text-red-300 hover:text-red-200"
                                >
                                  Entfernen
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeCategory === 'notifications' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Desktop-Status</div>
                      <p className="text-gray-400 text-sm">Steuert, wann CT Desktop-Benachrichtigungen zeigt.</p>
                    </div>
                    <button
                      onClick={handleRequestPermission}
                      className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[color:var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
                    >
                      Berechtigung anfragen
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                      <input
                        type="checkbox"
                        checked={notifyMentions}
                        onChange={(e) => setNotifyMentions(e.target.checked)}
                        className="form-checkbox h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">Erwähnungen</div>
                        <div className="text-xs text-gray-500">Benachrichtige mich bei Erwähnungen.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                      <input
                        type="checkbox"
                        checked={notifyDirectMessages}
                        onChange={(e) => setNotifyDirectMessages(e.target.checked)}
                        className="form-checkbox h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">Direktnachrichten</div>
                        <div className="text-xs text-gray-500">Hinweise auf neue private Nachrichten.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={notifyInvites}
                        onChange={(e) => setNotifyInvites(e.target.checked)}
                        className="form-checkbox h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">Server-Einladungen</div>
                        <div className="text-xs text-gray-500">Zeige eine Benachrichtigung, wenn dich jemand einlädt.</div>
                      </div>
                    </label>
                  </div>

                  <div className="text-xs text-gray-400 bg-white/[0.04] border border-[var(--color-border)] rounded-xl p-3 flex items-center gap-2">
                    <Bell size={14} />
                    <div>
                      <div className="font-semibold">Status: {permissionLabel}</div>
                      <div className="text-[11px] text-gray-500">
                        Browser-Entscheidungen werden gespeichert, damit CT weiß, ob Benachrichtigungen ausgeliefert werden dürfen.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeCategory === 'devices' && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                  
                  {/* Geräteauswahl */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Geräte</div>
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
                  </div>

                  {/* Mikrofon Einstellungen & Pegel */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                      <Volume2 size={14} /> Mikrofon-Test & Pegel
                    </div>
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4">
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
                      
                      <div className="space-y-1">
                        <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all"
                            style={{ width: `${levelPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span className={meterError ? 'text-red-400' : ''}>
                            {meterError || 'Sprich in dein Mikrofon, um den Pegel zu testen.'}
                          </span>
                          <span className="text-cyan-400 font-semibold">{levelPercent}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sprach-Aktivierung */}
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Sprach-Aktivierung</div>
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div>
                          <div className="text-sm font-semibold text-white">Push-to-Talk</div>
                          <p className="text-xs text-gray-400">Nur senden, wenn Taste gedrückt.</p>
                        </div>
                        <button
                          onClick={() => setPushToTalkEnabled((v) => !v)}
                          className={`px-4 py-2 rounded-xl border ${pushToTalkEnabled ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-gray-300 hover:text-white hover:border-white/30'}`}
                        >
                          {pushToTalkEnabled ? 'An' : 'Aus'}
                        </button>
                      </div>
                    </div>

                    {/* Audio Steuerung */}
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Audio-Steuerung</div>

                      {/* Mute Controls */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLocallyMuted((v) => !v)}
                          className={`flex-1 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${locallyMuted ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
                        >
                          <Headphones size={16} />
                          {locallyMuted ? 'Entstummen' : 'Stumm (Alle)'}
                        </button>

                        <button
                          onClick={() => setLocallyMicMuted((v) => !v)}
                          className={`flex-1 px-3 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${locallyMicMuted ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
                        >
                          <Mic size={16} />
                          {locallyMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                        </button>
                      </div>

                      {/* Output Test */}
                      <div className="p-3 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-400">
                          Testton abspielen
                          {outputError && <span className="block text-red-400">{outputError}</span>}
                        </div>
                        <button
                          onClick={handleTestOutput}
                          disabled={isTestingOutput}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-2 text-xs font-bold"
                        >
                          <Play size={14} /> {isTestingOutput ? '...' : 'Test'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Audio-Filter</div>
                    <div className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">RNNoise Rauschunterdrückung</div>
                        <p className="text-xs text-gray-400">
                          Verarbeitet dein Mikrofon über den RNNoise-Audioknoten. Bei fehlender Unterstützung wird automatisch der
                          Original-Stream genutzt.
                        </p>
                        {!rnnoiseAvailable && (
                          <div className="text-[11px] text-amber-300 mt-1">
                            RNNoise ist in dieser Umgebung nicht verfügbar. Die Aufnahme läuft ohne zusätzliche Filter.
                          </div>
                        )}
                        {rnnoiseError && <div className="text-[11px] text-red-400 mt-1">{rnnoiseError}</div>}
                      </div>
                      <button
                        onClick={() => setUseRnnoise((v) => !v)}
                        disabled={!rnnoiseAvailable}
                        className={`px-4 py-2 rounded-xl border ${
                          useRnnoise
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                            : 'border-white/10 text-gray-300 hover:text-white hover:border-white/30'
                        } ${!rnnoiseAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {useRnnoise ? 'Aktiv' : 'Aus'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {activeCategory === 'hotkeys' && (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Hotkeys</div>
                  <p className="text-gray-400 text-sm">
                    Lege Tasten für Push-to-Talk, Schnelles Muten und Navigation fest. Leere Felder deaktivieren den jeweiligen
                    Hotkey.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <HotkeyInput label="Push-to-Talk" value={pushToTalk} onChange={setPushToTalkHotkey} />
                    <HotkeyInput label="Mute Toggle" value={muteToggle} onChange={setMuteToggle} />
                    <HotkeyInput
                      label="Command Palette"
                      value={commandPaletteHotkey}
                      onChange={setCommandPaletteHotkey}
                    />
                    <HotkeyInput
                      label="Mitglieder umschalten"
                      value={toggleMembersHotkey}
                      onChange={setToggleMembersHotkey}
                    />
                    <HotkeyInput
                      label="Navigation umschalten"
                      value={toggleNavigationHotkey}
                      onChange={setToggleNavigationHotkey}
                    />
                    <HotkeyInput
                      label="Skip to content"
                      value={skipToContentHotkey}
                      onChange={setSkipToContentHotkey}
                    />
                  </div>
                  <div className="text-[11px] text-amber-200 bg-amber-400/10 border border-amber-400/40 rounded-xl p-3">
                    <strong className="font-semibold">Hinweis zu Browser-Shortcuts:</strong> Einige Kombinationen werden ggf.
                    vom Browser abgefangen (z. B. Ctrl+K für die Adressleiste oder Ctrl+Shift+D zum Speichern aller Tabs).
                    Passe die Hotkeys an, wenn sie nicht ausgelöst werden.
                  </div>
                </div>
              )}

              {activeCategory === 'identity' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/5 shrink-0">
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
    target
  );
};
