import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ProfileSettings = {
  displayName: string;
  avatarUrl: string;
};

export type DeviceSettings = {
  audioInputId: string | null;
  audioOutputId: string | null;
  videoInputId: string | null;
};

export type HotkeySettings = {
  pushToTalk: string | null;
  muteToggle: string | null;
};

export type TalkSettings = {
  muted: boolean;
  micMuted: boolean;
  pushToTalkEnabled: boolean;
  cameraQuality?: 'low' | 'medium' | 'high';
  screenQuality?: 'low' | 'medium' | 'high';
  screenFrameRate?: number;
  screenBitrateProfile?: 'low' | 'medium' | 'high';
  participantVolumes?: Record<string, number>;
  rnnoiseEnabled?: boolean;
};

export type SettingsState = {
  profile: ProfileSettings;
  devices: DeviceSettings;
  hotkeys: HotkeySettings;
  talk: TalkSettings;
};

const SETTINGS_STORAGE_KEY = 'ct.settings';

const defaultSettings: SettingsState = {
  profile: {
    displayName: '',
    avatarUrl: '',
  },
  devices: {
    audioInputId: null,
    audioOutputId: null,
    videoInputId: null,
  },
  hotkeys: {
    pushToTalk: null,
    muteToggle: null,
  },
  talk: {
    muted: false,
    micMuted: false,
    pushToTalkEnabled: false,
    cameraQuality: 'medium',
    screenQuality: 'high',
    screenFrameRate: 30,
    screenBitrateProfile: 'medium',
    participantVolumes: {},
    rnnoiseEnabled: false,
  },
};

const createDefaultSettings = (): SettingsState => ({
  profile: { ...defaultSettings.profile },
  devices: { ...defaultSettings.devices },
  hotkeys: { ...defaultSettings.hotkeys },
  talk: { ...defaultSettings.talk },
});

const SettingsContext = createContext<{
  settings: SettingsState;
  updateProfile: (nextProfile: Partial<ProfileSettings>) => void;
  updateDevices: (nextDevices: Partial<DeviceSettings>) => void;
  updateHotkeys: (nextHotkeys: Partial<HotkeySettings>) => void;
  updateTalk: (nextTalk: Partial<TalkSettings>) => void;
  resetSettings: () => void;
} | null>(null);

const loadInitialSettings = (): SettingsState => {
  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SettingsState;
      return {
        profile: { ...defaultSettings.profile, ...parsed.profile },
        devices: { ...defaultSettings.devices, ...parsed.devices },
        hotkeys: { ...defaultSettings.hotkeys, ...parsed.hotkeys },
        talk: { ...defaultSettings.talk, ...parsed.talk },
      };
    } catch (err) {
      console.warn('Could not parse stored settings', err);
    }
  }

  const rawUser = localStorage.getItem('clover_user');
  if (rawUser) {
    try {
      const parsedUser = JSON.parse(rawUser) as { username?: string };
      return {
        ...createDefaultSettings(),
        profile: {
          ...defaultSettings.profile,
          displayName: parsedUser.username || '',
        },
      };
    } catch (err) {
      console.warn('Could not parse clover_user', err);
    }
  }

  return createDefaultSettings();
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<SettingsState>(() => loadInitialSettings());

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateProfile = (nextProfile: Partial<ProfileSettings>) => {
    setSettings((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...nextProfile },
    }));
  };

  const updateDevices = (nextDevices: Partial<DeviceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      devices: { ...prev.devices, ...nextDevices },
    }));
  };

  const updateHotkeys = (nextHotkeys: Partial<HotkeySettings>) => {
    setSettings((prev) => ({
      ...prev,
      hotkeys: { ...prev.hotkeys, ...nextHotkeys },
    }));
  };

  const updateTalk = (nextTalk: Partial<TalkSettings>) => {
    setSettings((prev) => ({
      ...prev,
      talk: { ...prev.talk, ...nextTalk },
    }));
  };

  const resetSettings = () => setSettings(createDefaultSettings());

  const value = useMemo(
    () => ({ settings, updateProfile, updateDevices, updateHotkeys, updateTalk, resetSettings }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
