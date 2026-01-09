import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n/config';
import { storage } from '../shared/config/storage';

export type ProfileSettings = {
  displayName: string;
  avatarUrl: string;
  status?: string;
};

export type DeviceSettings = {
  audioInputId: string | null;
  audioOutputId: string | null;
  videoInputId: string | null;
};

export type HotkeySettings = {
  pushToTalk: string | null;
  muteToggle: string | null;
  commandPalette: string | null;
  toggleMembers: string | null;
  toggleNavigation: string | null;
};

export const defaultHotkeySettings: HotkeySettings = {
  pushToTalk: null,
  muteToggle: null,
  commandPalette: 'Ctrl+K',
  toggleMembers: 'Ctrl+Shift+M',
  toggleNavigation: 'Ctrl+Shift+D',
};

export type ThemeSettings = {
  mode: 'light' | 'dark';
  accentColor: string;
  serverAccents: Record<number, string>;
  decorationsEnabled?: boolean;
  density: 'comfortable' | 'compact';
};

export type TalkSettings = {
  muted: boolean;
  micMuted: boolean;
  pushToTalkEnabled: boolean;
  outputVolume?: number;
  iceServers?: RTCIceServer[];
  showVoicePreJoin?: boolean;
  audioPreset?: 'voice' | 'high' | 'music';
  cameraQuality?: 'low' | 'medium' | 'high';
  screenQuality?: 'low' | 'medium' | 'high' | 'native';
  screenFrameRate?: number | 'native';
  screenBitrateProfile?: 'low' | 'medium' | 'high' | 'max';
  participantVolumes?: Record<string, number>;
  rnnoiseEnabled?: boolean;
  vadSensitivity?: number; // Hinzugefügt
};

export type NotificationSettings = {
  permission: NotificationPermission | 'unsupported';
  mentions: boolean;
  directMessages: boolean;
  invites: boolean;
};

export type SettingsState = {
  profile: ProfileSettings;
  devices: DeviceSettings;
  hotkeys: HotkeySettings;
  theme: ThemeSettings;
  talk: TalkSettings;
  locale: string;
  notifications: NotificationSettings;
};

const resolveInitialPermission = (): NotificationSettings['permission'] => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
};

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
  hotkeys: { ...defaultHotkeySettings },
  theme: {
    mode: 'dark',
    accentColor: '#6366f1',
    serverAccents: {},
    decorationsEnabled: true,
    density: 'comfortable',
  },
  talk: {
    muted: false,
    micMuted: false,
    pushToTalkEnabled: false,
    showVoicePreJoin: true,
    audioPreset: 'voice',
    outputVolume: 1,
    iceServers: undefined,
    cameraQuality: 'medium',
    screenQuality: 'high',
    screenFrameRate: 30,
    screenBitrateProfile: 'medium',
    participantVolumes: {},
    rnnoiseEnabled: false,
    vadSensitivity: 50, // Standardwert
  },
  locale: 'en',
  notifications: {
    permission: resolveInitialPermission(),
    mentions: true,
    directMessages: true,
    invites: true,
  },
};

const createDefaultSettings = (): SettingsState => ({
  profile: { ...defaultSettings.profile },
  devices: { ...defaultSettings.devices },
  hotkeys: { ...defaultSettings.hotkeys },
  theme: { ...defaultSettings.theme },
  talk: { ...defaultSettings.talk },
  locale: defaultSettings.locale,
  notifications: { ...defaultSettings.notifications },
});

const SettingsContext = createContext<{
  settings: SettingsState;
  updateProfile: (nextProfile: Partial<ProfileSettings>) => void;
  updateDevices: (nextDevices: Partial<DeviceSettings>) => void;
  updateHotkeys: (nextHotkeys: Partial<HotkeySettings>) => void;
  updateTheme: (nextTheme: Partial<ThemeSettings>) => void;
  updateTalk: (nextTalk: Partial<TalkSettings>) => void;
  updateLocale: (nextLocale: string) => void;
  updateNotifications: (nextNotifications: Partial<NotificationSettings>) => void;
  resetSettings: () => void;
} | null>(null);

const loadInitialSettings = (): SettingsState => {
  const stored = storage.get('settings') as SettingsState | null;
  if (stored) {
    try {
      return {
        profile: { ...defaultSettings.profile, ...stored.profile },
        devices: { ...defaultSettings.devices, ...stored.devices },
        hotkeys: { ...defaultSettings.hotkeys, ...stored.hotkeys },
        theme: { ...defaultSettings.theme, ...stored.theme, serverAccents: stored.theme?.serverAccents || {} },
        talk: { ...defaultSettings.talk, ...stored.talk },
        locale: stored.locale || defaultSettings.locale,
        notifications: { ...defaultSettings.notifications, ...stored.notifications },
      };
    } catch (err) {
      console.warn('Could not parse stored settings', err);
    }
  }

  const rawUser = storage.get('cloverUser');
  if (rawUser && Object.keys(rawUser).length) {
    try {
      const parsedUser = rawUser as { username?: string };
      return {
        ...createDefaultSettings(),
        profile: {
          ...defaultSettings.profile,
          displayName: parsedUser.username || '',
        },
        locale: defaultSettings.locale,
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
    storage.set('settings', settings);
  }, [settings]);

  useEffect(() => {
    if (i18n.language !== settings.locale) {
      i18n.changeLanguage(settings.locale).catch((err) => console.warn('Could not change language', err));
    }
  }, [settings.locale]);

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

  const updateTheme = (nextTheme: Partial<ThemeSettings>) => {
    setSettings((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        ...nextTheme,
        serverAccents: nextTheme.serverAccents ?? prev.theme.serverAccents,
      },
    }));
  };

  const updateLocale = (nextLocale: string) => {
    setSettings((prev) => ({
      ...prev,
      locale: nextLocale,
    }));
  };

  const updateNotifications = (nextNotifications: Partial<NotificationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...nextNotifications },
    }));
  };

  const resetSettings = () => setSettings(createDefaultSettings());

  const value = useMemo(
    () => ({
      settings,
      updateProfile,
      updateDevices,
      updateHotkeys,
      updateTheme,
      updateTalk,
      updateLocale,
      updateNotifications,
      resetSettings,
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
