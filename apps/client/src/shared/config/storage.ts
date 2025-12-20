import type { IdentityFile } from '../../auth/identity';
import type { SettingsState } from '../../context/SettingsContext';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

interface StorageConfig<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  migrate?: (value: T) => T;
}

const booleanDeserializer = (raw: string) => raw === '1' || raw === 'true';
const booleanSerializer = (value: boolean) => (value ? '1' : '0');
const numberDeserializer = (raw: string, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeJsonParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const defaultOnboardingReplayState = {
  identity: false,
  servers: false,
  voice: false,
  settings: false,
};

const STORAGE_CONFIG = {
  layoutLeftWidth: {
    key: 'ct.layout.left_width',
    defaultValue: 256,
    deserialize: (raw: string) => numberDeserializer(raw, 256),
    migrate: (value: number) => (Number.isFinite(value) && value > 0 ? value : 256),
  },
  layoutRightWidth: {
    key: 'ct.layout.right_width',
    defaultValue: 256,
    deserialize: (raw: string) => numberDeserializer(raw, 256),
    migrate: (value: number) => (Number.isFinite(value) && value > 0 ? value : 256),
  },
  onboardingDone: {
    key: 'ct.onboarding.v1.done',
    defaultValue: false,
    deserialize: booleanDeserializer,
    serialize: booleanSerializer,
  },
  onboardingReplays: {
    key: 'ct.onboarding.v1.replays',
    defaultValue: defaultOnboardingReplayState,
    deserialize: (raw: string) => ({ ...defaultOnboardingReplayState, ...safeJsonParse(raw, defaultOnboardingReplayState) }),
    serialize: (value: typeof defaultOnboardingReplayState) => JSON.stringify(value ?? defaultOnboardingReplayState),
  },
  pendingServerId: {
    key: 'ct.pending_server_id',
    defaultValue: null as number | null,
    deserialize: (raw: string) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    },
  },
  firstStartDone: {
    key: 'ct.firststart.v1.done',
    defaultValue: false,
    deserialize: booleanDeserializer,
    serialize: booleanSerializer,
  },
  cloverUser: {
    key: 'clover_user',
    defaultValue: {} as Record<string, any>,
    deserialize: (raw: string) => safeJsonParse(raw, {}),
    serialize: (value: Record<string, any>) => JSON.stringify(value ?? {}),
  },
  cloverToken: {
    key: 'clover_token',
    defaultValue: null as string | null,
  },
  ctJwt: {
    key: 'ct.jwt',
    defaultValue: null as string | null,
  },
  cloverServerPassword: {
    key: 'clover_server_password',
    defaultValue: '',
  },
  cloverServerUrl: {
    key: 'clover_server_url',
    defaultValue: '',
  },
  livekitUrl: {
    key: 'clover_livekit_url',
    defaultValue: null as string | null,
  },
  identity: {
    key: 'ct.identity.v1',
    defaultValue: null as IdentityFile | null,
    deserialize: (raw: string) => safeJsonParse(raw, null as IdentityFile | null),
    serialize: (value: IdentityFile | null) => JSON.stringify(value),
  },
  settings: {
    key: 'ct.settings',
    defaultValue: null as SettingsState | null,
    deserialize: (raw: string) => safeJsonParse(raw, null as SettingsState | null),
    serialize: (value: SettingsState | null) => JSON.stringify(value),
  },
  pinnedServers: {
    key: 'ct.pinned_servers.v1',
    defaultValue: [] as any[],
    deserialize: (raw: string) => safeJsonParse(raw, []),
    serialize: (value: any[]) => JSON.stringify(value ?? []),
  },
  serverRailOrder: {
    key: 'ct.server_rail.order.v1',
    defaultValue: [] as number[],
    deserialize: (raw: string) => safeJsonParse(raw, [] as number[]),
    serialize: (value: number[]) => JSON.stringify(value ?? []),
  },
  serverRailPinned: {
    key: 'ct.server_rail.pinned.v1',
    defaultValue: [] as number[],
    deserialize: (raw: string) => safeJsonParse(raw, [] as number[]),
    serialize: (value: number[]) => JSON.stringify(value ?? []),
  },
  serverRailAliases: {
    key: 'ct.server_rail.aliases.v1',
    defaultValue: {} as Record<number, string>,
    deserialize: (raw: string) => safeJsonParse(raw, {} as Record<number, string>),
    serialize: (value: Record<number, string>) => JSON.stringify(value ?? {}),
  },
} satisfies Record<string, StorageConfig<any>>;

export type StorageKey = keyof typeof STORAGE_CONFIG;
export type StorageValue<K extends StorageKey> = (typeof STORAGE_CONFIG)[K]['defaultValue'];

const getConfig = <K extends StorageKey>(key: K): StorageConfig<StorageValue<K>> =>
  STORAGE_CONFIG[key] as StorageConfig<StorageValue<K>>;

function resolveValue<T>(raw: string | null, config: StorageConfig<T>): T {
  if (raw === null || raw === undefined) return config.defaultValue;
  const deserializer = config.deserialize ?? ((value: string) => value as unknown as T);
  const migrated = config.migrate ?? ((value: T) => value);
  return migrated(deserializer(raw));
}

function storeValue<T>(value: T, config: StorageConfig<T>) {
  if (!isBrowser) return;
  const serializer = config.serialize ?? ((val: T) => String(val));
  const migrated = config.migrate ?? ((val: T) => val);
  localStorage.setItem(config.key, serializer(migrated(value)));
}

export function getStorageItem<K extends StorageKey>(key: K): StorageValue<K> {
  const config = getConfig(key);
  if (!isBrowser) return config.defaultValue;
  const raw = localStorage.getItem(config.key);
  return resolveValue(raw, config);
}

export function setStorageItem<K extends StorageKey>(key: K, value: StorageValue<K>): void {
  const config = getConfig(key);
  storeValue(value, config);
}

export function removeStorageItem<K extends StorageKey>(key: K): void {
  if (!isBrowser) return;
  const config = getConfig(key);
  localStorage.removeItem(config.key);
}

export const storageKeys = Object.fromEntries(
  Object.entries(STORAGE_CONFIG).map(([alias, config]) => [alias as StorageKey, config.key])
) as Record<StorageKey, string>;

export const storage = {
  get: getStorageItem,
  set: setStorageItem,
  remove: removeStorageItem,
};

export type StorageConfigMap = typeof STORAGE_CONFIG;
export type OnboardingReplayState = typeof defaultOnboardingReplayState;
