import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ChangeEvent, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from './modalRoot';
import { useTopBar } from '../window/TopBarContext';
import {
  Camera,
  Check,
  Download,
  Loader2,
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
  Search,
  User,
  X,
  Monitor,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../../api/http';
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
        {displayValue && <span className="text-[10px] text-[color:var(--color-accent)]">Press Backspace/Esc to clear</span>}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={displayValue}
          onKeyDown={handleKeyDown}
          readOnly
          placeholder="Press keys"
          className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
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

type CategoryId = 'profile' | 'appearance' | 'notifications' | 'devices' | 'hotkeys' | 'identity';
type Category = { id: CategoryId; label: string; icon: LucideIcon };

export const UserSettingsModal = ({
  onClose,
  initialCategory,
  initialDevicesTab = 'voice',
}: {
  onClose: () => void;
  initialCategory?: CategoryId;
  initialDevicesTab?: 'voice' | 'video' | 'stream';
}) => {
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

  const { settings, updateDevices, updateHotkeys, updateProfile, updateTheme, updateNotifications, updateTalk } = useSettings();
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
  const [commandPaletteHotkey, setCommandPaletteHotkey] = useState<string>(
    settings.hotkeys.commandPalette ?? defaultHotkeySettings.commandPalette ?? ''
  );
  const [notificationPermission, setNotificationPermission] = useState(settings.notifications.permission);
  const [notifyMentions, setNotifyMentions] = useState(settings.notifications.mentions);
  const [notifyDirectMessages, setNotifyDirectMessages] = useState(settings.notifications.directMessages);
  const [notifyInvites, setNotifyInvites] = useState(settings.notifications.invites);
  const [toggleMembersHotkey, setToggleMembersHotkey] = useState<string>(
    settings.hotkeys.toggleMembers ?? defaultHotkeySettings.toggleMembers ?? ''
  );
  const [toggleNavigationHotkey, setToggleNavigationHotkey] = useState<string>(
    settings.hotkeys.toggleNavigation ?? defaultHotkeySettings.toggleNavigation ?? ''
  );
  const [skipToContentHotkey, setSkipToContentHotkey] = useState<string>(
    settings.hotkeys.skipToContent ?? defaultHotkeySettings.skipToContent ?? ''
  );
  const [deviceLists, setDeviceLists] = useState<DeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(usePushToTalk);
  const [locallyMuted, setLocallyMuted] = useState(muted);
  const [locallyMicMuted, setLocallyMicMuted] = useState(micMuted);
  const [showVoicePreJoin, setShowVoicePreJoin] = useState(settings.talk.showVoicePreJoin ?? true);
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(settings.talk.vadSensitivity ?? 50);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [isTestingOutput, setIsTestingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [useRnnoise, setUseRnnoise] = useState(rnnoiseEnabled);
  const [cameraQuality, setCameraQuality] = useState(settings.talk.cameraQuality || 'medium');
  const [screenQuality, setScreenQuality] = useState<'low' | 'medium' | 'high' | 'native'>(
    settings.talk.screenQuality || 'high'
  );
  const [screenFrameRate, setScreenFrameRate] = useState<number | 'native'>(settings.talk.screenFrameRate ?? 30);
  const [screenBitrateProfile, setScreenBitrateProfile] = useState<'low' | 'medium' | 'high' | 'max'>(
    settings.talk.screenBitrateProfile || 'medium'
  );
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [identityName, setIdentityName] = useState(identity?.displayName ?? '');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState(settings.theme.mode);
  const [accentColor, setAccentColor] = useState(settings.theme.accentColor);
  const [serverAccentDraft, setServerAccentDraft] = useState<Record<number, string>>(settings.theme.serverAccents || {});
  const [serverAccentTarget, setServerAccentTarget] = useState('');
  const [serverAccentColor, setServerAccentColor] = useState(settings.theme.accentColor);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(settings.profile.avatarUrl || '');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // 'Talk & Audio' wurde in 'devices' integriert und entfernt
  const categories = useMemo<Category[]>(
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

  const screenResolutionOptions = [
    { value: 'low', label: 'Niedrig', description: '480p' },
    { value: 'medium', label: 'Mittel', description: '720p' },
    { value: 'high', label: 'Hoch', description: '1080p' },
    { value: 'native', label: 'Nativ', description: 'Geräte-Standard' },
  ] as const;

  const screenFrameRateOptions = [
    { value: 15, label: '15 FPS', description: 'Sparsam' },
    { value: 30, label: '30 FPS', description: 'Standard' },
    { value: 60, label: '60 FPS', description: 'Flüssig' },
    { value: 'native', label: 'Nativ', description: 'Systemstandard' },
  ] as const;

  const screenBitrateOptions = [
    { value: 'low', label: 'Low', description: '5 Mbit/s' },
    { value: 'medium', label: 'Mittel', description: '7,5 Mbit/s' },
    { value: 'high', label: 'High', description: '10 Mbit/s' },
    { value: 'max', label: 'Max', description: '15 Mbit/s' },
  ] as const;

  const [activeCategory, setActiveCategory] = useState<CategoryId>(initialCategory ?? (categories[0]?.id as CategoryId));
  const [navQuery, setNavQuery] = useState('');
  const [devicesTab, setDevicesTab] = useState<'voice' | 'video' | 'stream'>(initialDevicesTab);
  const [micTestNonce, setMicTestNonce] = useState(0);


  const filteredCategories = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, navQuery]);

  const activeCategoryMeta = useMemo(
    () => categories.find((c) => c.id === activeCategory) ?? categories[0],
    [categories, activeCategory]
  );
  const activeCategoryLabel = activeCategoryMeta?.label ?? 'Einstellungen';

  const avatarInitials = useMemo(() => {
    const raw = (displayName || settings.profile.displayName || 'CT').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] ?? 'C').toUpperCase();
    const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? 'T').toUpperCase();
    return `${a}${b}`;
  }, [displayName, settings.profile.displayName]);

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
          const level = Math.min(1, rms * 2 * (sensitivity / 50));
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
  }, [audioInputId, sensitivity, micTestNonce]);

  useEffect(() => {
    if (!avatarFile) return;
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  useEffect(() => {
    if (avatarFile) return;
    setAvatarPreview(avatarUrl || settings.profile.avatarUrl || '');
  }, [avatarFile, avatarUrl, settings.profile.avatarUrl]);

  const levelPercent = useMemo(() => Math.round(inputLevel * 100), [inputLevel]);
  const fingerprint = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);
  const permissionLabel = useMemo(() => {
    if (notificationPermission === 'granted') return 'Aktiv';
    if (notificationPermission === 'denied') return 'Blockiert';
    if (notificationPermission === 'unsupported') return 'Nicht unterstützt';
    return 'Unbestätigt';
  }, [notificationPermission]);


  const isDirty = useMemo(() => {
    const normalizeHotkey = (value: string) => (value.trim() ? value.trim() : null);
    const normalizeDevice = (value: string) => (value ? value : null);

    if (displayName !== settings.profile.displayName) return true;
    if (avatarUrl !== settings.profile.avatarUrl) return true;
    if (avatarFile) return true;

    if (normalizeDevice(audioInputId) !== settings.devices.audioInputId) return true;
    if (normalizeDevice(audioOutputId) !== settings.devices.audioOutputId) return true;
    if (normalizeDevice(videoInputId) !== settings.devices.videoInputId) return true;

    if (normalizeHotkey(pushToTalk) !== settings.hotkeys.pushToTalk) return true;
    if (normalizeHotkey(muteToggle) !== settings.hotkeys.muteToggle) return true;
    if (normalizeHotkey(commandPaletteHotkey) !== settings.hotkeys.commandPalette) return true;
    if (normalizeHotkey(toggleMembersHotkey) !== settings.hotkeys.toggleMembers) return true;
    if (normalizeHotkey(toggleNavigationHotkey) !== settings.hotkeys.toggleNavigation) return true;
    if (normalizeHotkey(skipToContentHotkey) !== settings.hotkeys.skipToContent) return true;

    if (themeMode !== settings.theme.mode) return true;
    if (accentColor !== settings.theme.accentColor) return true;
    if (JSON.stringify(serverAccentDraft) !== JSON.stringify(settings.theme.serverAccents || {})) return true;

    if (notificationPermission !== settings.notifications.permission) return true;
    if (notifyMentions !== settings.notifications.mentions) return true;
    if (notifyDirectMessages !== settings.notifications.directMessages) return true;
    if (notifyInvites !== settings.notifications.invites) return true;

    if (pushToTalkEnabled !== usePushToTalk) return true;
    if (locallyMuted !== muted) return true;
    if (locallyMicMuted !== micMuted) return true;
    if (useRnnoise !== rnnoiseEnabled) return true;
    if (cameraQuality !== (settings.talk.cameraQuality || 'medium')) return true;
    if (screenQuality !== (settings.talk.screenQuality || 'high')) return true;
    if (screenFrameRate !== (settings.talk.screenFrameRate ?? 30)) return true;
    if (screenBitrateProfile !== (settings.talk.screenBitrateProfile || 'medium')) return true;
    if (sensitivity !== (settings.talk.vadSensitivity ?? 50)) return true;

    return false;
  }, [
    displayName,
    avatarUrl,
    audioInputId,
    audioOutputId,
    videoInputId,
    pushToTalk,
    muteToggle,
    commandPaletteHotkey,
    toggleMembersHotkey,
    toggleNavigationHotkey,
    skipToContentHotkey,
    themeMode,
    accentColor,
    serverAccentDraft,
    notificationPermission,
    notifyMentions,
    notifyDirectMessages,
    notifyInvites,
    pushToTalkEnabled,
    usePushToTalk,
    locallyMuted,
    muted,
    locallyMicMuted,
    micMuted,
    useRnnoise,
    rnnoiseEnabled,
    cameraQuality,
    screenQuality,
    screenFrameRate,
    screenBitrateProfile,
    sensitivity,
    settings,
  ]);

  const resetDraft = useCallback(() => {
    setDisplayName(settings.profile.displayName);
    setAvatarUrl(settings.profile.avatarUrl);
    setAvatarPreview(settings.profile.avatarUrl || '');
    setAvatarFile(null);
    setAvatarError(null);

    setAudioInputId(settings.devices.audioInputId || selectedAudioInputId || '');
    setAudioOutputId(settings.devices.audioOutputId || selectedAudioOutputId || '');
    setVideoInputId(settings.devices.videoInputId || '');

    setPushToTalkHotkey(settings.hotkeys.pushToTalk || '');
    setMuteToggle(settings.hotkeys.muteToggle || '');
    setCommandPaletteHotkey(settings.hotkeys.commandPalette ?? defaultHotkeySettings.commandPalette ?? '');
    setToggleMembersHotkey(settings.hotkeys.toggleMembers ?? defaultHotkeySettings.toggleMembers ?? '');
    setToggleNavigationHotkey(settings.hotkeys.toggleNavigation ?? defaultHotkeySettings.toggleNavigation ?? '');
    setSkipToContentHotkey(settings.hotkeys.skipToContent ?? defaultHotkeySettings.skipToContent ?? '');

    setThemeMode(settings.theme.mode);
    setAccentColor(settings.theme.accentColor);
    setServerAccentDraft(settings.theme.serverAccents || {});

    setNotificationPermission(settings.notifications.permission);
    setNotifyMentions(settings.notifications.mentions);
    setNotifyDirectMessages(settings.notifications.directMessages);
    setNotifyInvites(settings.notifications.invites);

    setPushToTalkEnabled(usePushToTalk);
    setLocallyMuted(muted);
    setLocallyMicMuted(micMuted);
    setUseRnnoise(rnnoiseEnabled);
    setCameraQuality(settings.talk.cameraQuality || 'medium');
    setScreenQuality(settings.talk.screenQuality || 'high');
    setScreenFrameRate(settings.talk.screenFrameRate ?? 30);
    setScreenBitrateProfile(settings.talk.screenBitrateProfile || 'medium');
    setSensitivity(settings.talk.vadSensitivity ?? 50);
  }, [
    muted,
    micMuted,
    rnnoiseEnabled,
    selectedAudioInputId,
    selectedAudioOutputId,
    settings,
    usePushToTalk,
  ]);

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

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarError(null);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setAvatarError('Bitte wähle eine Bilddatei aus.');
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await apiFetch<{ avatar_url: string }>('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      });

      setAvatarUrl(response.avatar_url);
      setAvatarPreview(response.avatar_url);
      setAvatarFile(null);
      updateProfile({ avatarUrl: response.avatar_url });
    } catch (err: any) {
      setAvatarError(err?.message || 'Upload fehlgeschlagen');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (avatarFile) {
      setAvatarError('Bitte lade den ausgewählten Avatar hoch oder entferne die Auswahl.');
      return;
    }
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
    updateTalk({
      showVoicePreJoin,
      cameraQuality,
      screenQuality,
      screenFrameRate,
      screenBitrateProfile,
      vadSensitivity: sensitivity,
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
            <nav className="bg-[var(--color-surface-alt)] border-r border-[var(--color-border)] p-4 flex flex-col gap-3 overflow-hidden">
  <button
    onClick={() => setActiveCategory('profile')}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition text-left"
  >
    <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
      {avatarPreview ? (
        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-[color:var(--color-accent)] font-bold">
          {avatarInitials}
        </div>
      )}
    </div>

    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold truncate">{displayName || 'Unbenannt'}</div>
      <div className="text-xs text-[color:var(--color-accent)]">Profil bearbeiten</div>
    </div>

    <User size={16} className="text-[color:var(--color-text-muted)]" />
  </button>

  <div className="relative">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
    <input
      value={navQuery}
      onChange={(e) => setNavQuery(e.target.value)}
      placeholder="Suche"
      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
    />
  </div>

  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
    <div className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold px-2 mb-2">
      Benutzereinstellungen
    </div>

    <div className="flex flex-col gap-1">
      {filteredCategories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setActiveCategory(cat.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-left transition ${
            activeCategory === cat.id
              ? 'bg-white/5 border border-white/10 text-[color:var(--color-text)]'
              : 'text-[color:var(--color-text-muted)] hover:bg-white/5'
          }`}
        >
          <cat.icon size={16} />
          <span className="truncate">{cat.label}</span>
        </button>
      ))}
      {filteredCategories.length === 0 && (
        <div className="px-3 py-2 text-sm text-[color:var(--color-text-muted)]">Keine Treffer.</div>
      )}
    </div>
  </div>
</nav>

            <div className="p-6 overflow-y-auto custom-scrollbar h-full">
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">Settings</div>
                  <h3 className="text-2xl font-bold">{activeCategoryLabel}</h3>
                </div>
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
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Avatar</label>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarFileChange}
                          />
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => avatarInputRef.current?.click()}
                                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-200 hover:bg-white/10"
                              >
                                Datei wählen
                              </button>
                              {avatarFile && (
                                <span className="text-xs text-gray-300 truncate max-w-[160px]" title={avatarFile.name}>
                                  {avatarFile.name}
                                </span>
                              )}
                              <button
                                onClick={handleAvatarUpload}
                                disabled={avatarUploading || (!avatarFile && !avatarUrl)}
                                className="px-4 py-2 rounded-xl bg-[var(--color-accent)]/80 hover:bg-[var(--color-accent)] text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {avatarUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                {avatarUploading ? 'Lade hoch...' : 'Avatar hochladen'}
                              </button>
                            </div>
                            <p className="text-xs text-gray-400">
                              Unterstützt Bilddateien bis 3 MB. Bereits gesetzte Avatar-Links bleiben bestehen, bis ein neuer Upload erfolgt.
                            </p>
                            {avatarError && <p className="text-xs text-red-400">{avatarError}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3 bg-white/5 rounded-2xl border border-white/10 p-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center text-[color:var(--color-accent)] font-bold text-xl">
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
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-[var(--color-border)]">
                    <div className="flex gap-6 text-sm font-semibold">
                      <button
                        onClick={() => setDevicesTab('voice')}
                        className={`pb-3 -mb-px border-b-2 transition ${
                          devicesTab === 'voice'
                            ? 'border-[var(--color-accent)] text-[color:var(--color-text)]'
                            : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                        }`}
                      >
                        Sprachchat
                      </button>
                      <button
                        onClick={() => setDevicesTab('video')}
                        className={`pb-3 -mb-px border-b-2 transition ${
                          devicesTab === 'video'
                            ? 'border-[var(--color-accent)] text-[color:var(--color-text)]'
                            : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                        }`}
                      >
                        Video
                      </button>
                      <button
                        onClick={() => setDevicesTab('stream')}
                        className={`pb-3 -mb-px border-b-2 transition ${
                          devicesTab === 'stream'
                            ? 'border-[var(--color-accent)] text-[color:var(--color-text)]'
                            : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                        }`}
                      >
                        Stream
                      </button>
                    </div>
                  </div>

                  {devicesTab === 'voice' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold">Voice-Check</div>
                            <p className="text-sm text-[color:var(--color-text-muted)]">
                              Überspringe die Vorabprüfung und trete Sprachkanälen direkt bei.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={showVoicePreJoin}
                              onChange={(e) => setShowVoicePreJoin(e.target.checked)}
                              className="form-checkbox h-4 w-4"
                            />
                            <span className="text-[color:var(--color-text)]">
                              {showVoicePreJoin ? 'Aktiviert' : 'Deaktiviert'}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Geräte */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold">Geräte</div>
                            <p className="text-sm text-[color:var(--color-text-muted)]">
                              Wähle dein Eingabe- und Ausgabegerät.
                            </p>
                          </div>
                          <button
                            onClick={refreshDevices}
                            className="flex items-center gap-2 text-sm text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)]"
                          >
                            <RefreshCw size={16} />
                            Aktualisieren
                          </button>
                        </div>

                        {deviceError && <div className="text-red-400 text-sm">{deviceError}</div>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="space-y-2">
                            <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold flex items-center gap-2">
                              <Mic size={14} /> Eingabegerät
                            </div>
                            <select
                              value={audioInputId}
                              onChange={(e) => setAudioInputId(e.target.value)}
                              className="w-full bg-[var(--color-surface-alt)] text-[color:var(--color-text)] p-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                            >
                              <option value="">System-Standard</option>
                              {deviceLists.audioInputs.map((d) => (
                                <option key={d.deviceId} value={d.deviceId}>
                                  {d.label || `Mikrofon (${d.deviceId.slice(0, 6)})`}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2">
                            <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold flex items-center gap-2">
                              <Headphones size={14} /> Ausgabegerät
                            </div>
                            <select
                              value={audioOutputId}
                              onChange={(e) => setAudioOutputId(e.target.value)}
                              className="w-full bg-[var(--color-surface-alt)] text-[color:var(--color-text)] p-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                            >
                              <option value="">System-Standard</option>
                              {deviceLists.audioOutputs.map((d) => (
                                <option key={d.deviceId} value={d.deviceId}>
                                  {d.label || `Ausgabe (${d.deviceId.slice(0, 6)})`}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      {/* Eingabelautstärke & Mikrofontest */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                        <div className="text-sm font-semibold">Mikrofontest</div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">
                              Eingabelautstärke
                            </div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">{Math.round(sensitivity)}%</div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={sensitivity}
                            onChange={(e) => setSensitivity(Number(e.target.value))}
                            className="w-full accent-[var(--color-accent)]"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">
                            Mikrofontest
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <button
                              onClick={() => setMicTestNonce((v) => v + 1)}
                              className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold"
                            >
                              Schauen wir mal
                            </button>

                            <div className="flex-1">
                              <div className="flex items-end gap-[2px] h-7">
                                {Array.from({ length: 60 }).map((_, i) => {
                                  const pattern = [6, 10, 14, 18, 14, 10, 8, 12, 16, 12, 9, 7];
                                  const height = pattern[i % pattern.length];
                                  const lit = i < Math.round(inputLevel * 60);
                                  return (
                                    <div
                                      key={i}
                                      style={{ height }}
                                      className={`w-[3px] rounded-sm ${lit ? 'bg-[var(--color-accent)]' : 'bg-white/10'}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            <div className="w-14 text-right text-xs text-[color:var(--color-text-muted)] tabular-nums">
                              {levelPercent}%
                            </div>
                          </div>

                          <div className="text-xs text-[color:var(--color-text-muted)]">
                            {meterError || 'Sprich in dein Mikrofon – wir spielen es dir danach wieder ab.'}
                          </div>
                        </div>
                      </div>

                      {/* Eingabemodus */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                        <div className="text-sm font-semibold">Eingabemodus</div>

                        <div className="space-y-2">
                          <button
                            onClick={() => setPushToTalkEnabled(false)}
                            className={`w-full p-4 rounded-2xl border text-left transition ${
                              !pushToTalkEnabled
                                ? 'bg-white/5 border-[var(--color-accent)]'
                                : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold">Sprachaktivierung</div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  Mikrofon ist aktiv, solange es nicht stumm ist.
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border ${!pushToTalkEnabled ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-border-strong)]'}`} />
                            </div>
                          </button>

                          <button
                            onClick={() => setPushToTalkEnabled(true)}
                            className={`w-full p-4 rounded-2xl border text-left transition ${
                              pushToTalkEnabled
                                ? 'bg-white/5 border-[var(--color-accent)]'
                                : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold">Push-to-Talk</div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  Nur senden, wenn Taste gedrückt.
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border ${pushToTalkEnabled ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-border-strong)]'}`} />
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Audio-Steuerung */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                        <div className="text-sm font-semibold">Audio-Steuerung</div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => setLocallyMuted((v) => !v)}
                            className={`flex-1 px-4 py-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                              locallyMuted
                                ? 'bg-red-500/15 border-red-400/30 text-red-200'
                                : 'bg-transparent border-[var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-white/5'
                            }`}
                          >
                            <Headphones size={16} />
                            {locallyMuted ? 'Entstummen (Alle)' : 'Stumm (Alle)'}
                          </button>

                          <button
                            onClick={() => setLocallyMicMuted((v) => !v)}
                            className={`flex-1 px-4 py-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                              locallyMicMuted
                                ? 'bg-red-500/15 border-red-400/30 text-red-200'
                                : 'bg-transparent border-[var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-white/5'
                            }`}
                          >
                            <Mic size={16} />
                            {locallyMicMuted ? 'Mikro an' : 'Mikro aus'}
                          </button>
                        </div>
                      </div>

                      {/* Rauschunterdrückung */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                        <div className="text-sm font-semibold">Rauschunterdrückung</div>

                        {!rnnoiseAvailable && (
                          <div className="text-xs text-[color:var(--color-text-muted)]">
                            RNNoise ist auf diesem System nicht verfügbar.
                          </div>
                        )}
                        {rnnoiseError && <div className="text-xs text-red-400">{rnnoiseError}</div>}

                        <button
                          disabled={!rnnoiseAvailable}
                          onClick={() => setUseRnnoise((v) => !v)}
                          className={`w-full px-4 py-3 rounded-xl border transition flex items-center justify-between ${
                            useRnnoise
                              ? 'bg-white/5 border-[var(--color-accent)]'
                              : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                          } ${!rnnoiseAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <div>
                            <div className="text-sm font-semibold">RNNoise</div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">Filtert Hintergrundgeräusche.</div>
                          </div>
                          <div
                            className={`w-10 h-6 rounded-full p-1 transition ${
                              useRnnoise ? 'bg-[var(--color-accent)]' : 'bg-white/10'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition ${
                                useRnnoise ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      </div>

                      {/* Ausgabegerät testen */}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                        <div className="text-sm font-semibold">Ausgabe testen</div>

                        <button
                          onClick={handleTestOutput}
                          disabled={isTestingOutput}
                          className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--color-border)] text-[color:var(--color-text)] flex items-center gap-2 disabled:opacity-60"
                        >
                          <Play size={18} />
                          {isTestingOutput ? 'Teste…' : 'Testton abspielen'}
                        </button>

                        {outputError && <div className="text-xs text-red-400">{outputError}</div>}
                      </div>
                    </div>
                  )}

                  {devicesTab === 'video' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                        <div className="text-sm font-semibold">Kamera</div>
                        <label className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold flex items-center gap-2">
                            <Camera size={14} /> Kamera
                          </div>
                          <select
                            value={videoInputId}
                            onChange={(e) => setVideoInputId(e.target.value)}
                            className="w-full bg-[var(--color-surface-alt)] text-[color:var(--color-text)] p-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          >
                            <option value="">System-Standard</option>
                            {deviceLists.videoInputs.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Kamera (${d.deviceId.slice(0, 6)})`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold flex items-center gap-2">
                            <Monitor size={14} /> Kameraqualität
                          </div>
                          <select
                            value={cameraQuality}
                            onChange={(e) => setCameraQuality(e.target.value as typeof cameraQuality)}
                            className="w-full bg-[var(--color-surface-alt)] text-[color:var(--color-text)] p-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                          >
                            <option value="low">Niedrig</option>
                            <option value="medium">Mittel</option>
                            <option value="high">Hoch</option>
                          </select>
                          <p className="text-xs text-[color:var(--color-text-muted)]">Beeinflusst die Standardqualität deiner Kameraübertragung.</p>
                        </label>
                        <div className="h-48 rounded-2xl bg-black/20 border border-[var(--color-border)] flex items-center justify-center text-sm text-[color:var(--color-text-muted)]">
                          Vorschau folgt (optional).
                        </div>
                      </div>
                    </div>
                  )}

                  {devicesTab === 'stream' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                        <div className="text-sm font-semibold">Stream-Qualität</div>
                        <p className="text-sm text-[color:var(--color-text-muted)]">
                          Passe Standardauflösung und Bildrate für Bildschirmübertragungen an.
                        </p>

                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">Auflösung</div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            {screenResolutionOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setScreenQuality(option.value)}
                                className={`p-4 rounded-xl border text-left transition ${
                                  screenQuality === option.value
                                    ? 'bg-white/5 border-[var(--color-accent)]'
                                    : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold">{option.label}</div>
                                  {screenQuality === option.value && <Check size={16} />}
                                </div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">{option.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">Bildrate</div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            {screenFrameRateOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setScreenFrameRate(option.value)}
                                className={`p-4 rounded-xl border text-left transition ${
                                  screenFrameRate === option.value
                                    ? 'bg-white/5 border-[var(--color-accent)]'
                                    : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold">{option.label}</div>
                                  {screenFrameRate === option.value && <Check size={16} />}
                                </div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">{option.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)] font-bold">Bitrate</div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            {screenBitrateOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setScreenBitrateProfile(option.value)}
                                className={`p-4 rounded-xl border text-left transition ${
                                  screenBitrateProfile === option.value
                                    ? 'bg-white/5 border-[var(--color-accent)]'
                                    : 'bg-transparent border-[var(--color-border)] hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold">{option.label}</div>
                                  {screenBitrateProfile === option.value && <Check size={16} />}
                                </div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">{option.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-alt)] shrink-0">
          {isDirty ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--color-text-muted)]">Du hast ungespeicherte Änderungen.</div>
              <div className="flex gap-2">
                <button
                  onClick={resetDraft}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--color-border)] text-[color:var(--color-text)]"
                >
                  Zurücksetzen
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white flex items-center gap-2"
                >
                  <Save size={16} />
                  Änderungen speichern
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                <Check size={14} className="text-green-400" />
                Änderungen werden lokal gespeichert.
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--color-border)] text-[color:var(--color-text)]"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    target
  );
};
