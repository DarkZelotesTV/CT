import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Headphones, Mic, RefreshCw, Save, Settings, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

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
  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [avatarUrl, setAvatarUrl] = useState(settings.profile.avatarUrl);
  const [audioInputId, setAudioInputId] = useState(settings.devices.audioInputId || '');
  const [audioOutputId, setAudioOutputId] = useState(settings.devices.audioOutputId || '');
  const [videoInputId, setVideoInputId] = useState(settings.devices.videoInputId || '');
  const [pushToTalk, setPushToTalk] = useState(settings.hotkeys.pushToTalk || '');
  const [muteToggle, setMuteToggle] = useState(settings.hotkeys.muteToggle || '');
  const [deviceLists, setDeviceLists] = useState<DeviceLists>({ audioInputs: [], audioOutputs: [], videoInputs: [] });
  const [deviceError, setDeviceError] = useState<string | null>(null);

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

  const avatarPreview = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    if (settings.profile.avatarUrl) return settings.profile.avatarUrl;
    return '';
  }, [avatarUrl, settings.profile.avatarUrl]);

  const handleSave = () => {
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
    onClose();
  };

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

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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

          <section className="space-y-3">
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

          <section className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Hotkeys</div>
            <p className="text-gray-400 text-sm">Lege Tasten für Push-to-Talk oder schnelles Muten fest.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HotkeyInput label="Push-to-Talk" value={pushToTalk} onChange={setPushToTalk} />
              <HotkeyInput label="Mute Toggle" value={muteToggle} onChange={setMuteToggle} />
            </div>
          </section>
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
