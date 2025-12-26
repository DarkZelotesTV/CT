import { storage } from '../shared/config/storage';

export const getAllowInsecureHttp = () => storage.get('allowInsecureHttp');
export const setAllowInsecureHttp = (value: boolean) => storage.set('allowInsecureHttp', value);

const getAppOrigin = () => {
  if (typeof window === 'undefined') return '';

  const origin = window.location?.origin ?? '';

  // In Electron (file://) oder bei Browsern mit file-origin ("null") darf die App-Origin
  // NICHT als Server-URL verwendet werden – sonst werden Requests/Assets gegen file:// aufgelöst.
  if (!origin || origin === 'null' || origin.startsWith('file:')) return '';

  return origin;
};

const preferredProtocol = (allowInsecure: boolean) => {
  if (typeof window === 'undefined') return allowInsecure ? 'http:' : 'https:';
  const protocol = window.location?.protocol;
  if (!allowInsecure && protocol === 'http:') return 'https:';
  if (protocol === 'https:' || protocol === 'http:') return protocol;
  return allowInsecure ? 'http:' : 'https:';
};

const buildFallbackUrl = (allowInsecure: boolean) => {
  const proto = preferredProtocol(allowInsecure);
  const hostname = 'localhost:3001';
  return `${proto}//${hostname}`;
};

export const getDefaultServerUrl = () => {
  // Wenn keine Server-URL gesetzt ist, verwenden wir die Herkunft der geladenen App.
  const allowInsecure = getAllowInsecureHttp();
  const origin = getAppOrigin();
  if (origin) return normalizeServerUrlString(origin, { allowInsecure });
  return buildFallbackUrl(allowInsecure);
};

export const normalizeServerUrlString = (
  rawUrl: string,
  { allowInsecure }: { allowInsecure?: boolean } = {}
): string => {
  const allow = allowInsecure ?? getAllowInsecureHttp();
  const sanitizedUrl = rawUrl.trim();
  const fallbackProtocol = preferredProtocol(allow);
  const fallback = buildFallbackUrl(allow);

  const parse = (candidate: string) => {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' && !allow) parsed.protocol = 'https:';
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') parsed.protocol = fallbackProtocol;
    parsed.pathname = parsed.pathname || '';
    return parsed.toString().replace(/\/$/, '');
  };

  try {
    return parse(sanitizedUrl);
  } catch (_err) {
    try {
      return parse(`${fallbackProtocol}//${sanitizedUrl}`);
    } catch (error) {
      const fallbackUrl = fallback;
      console.error('Invalid server URL configured, falling back to app origin.', error);
      return parse(fallbackUrl);
    }
  }
};

export const getServerUrl = (): string => {
  const stored = storage.get('cloverServerUrl');
  const url = (stored && stored.trim()) || getDefaultServerUrl();

  return normalizeServerUrlString(url);
};

export const setServerUrl = (url: string) => {
  storage.set('cloverServerUrl', url.trim());
};

export const getServerPassword = (): string => {
  return storage.get('cloverServerPassword') || '';
};

export const setServerPassword = (password: string) => {
  storage.set('cloverServerPassword', password);
};

export const resetServerSettings = () => {
  storage.remove('cloverServerUrl');
  storage.remove('cloverServerPassword');
  storage.set('allowInsecureHttp', false);
};

// --- URL Helpers ---

const asUrl = (url: string) => new URL(url);

const normalizeServerUrl = (rawUrl: string) => asUrl(normalizeServerUrlString(rawUrl));

const getServerUrlObject = () => normalizeServerUrl(getServerUrl());

export const getServerWebSocketUrl = () => {
  const serverUrl = getServerUrlObject();
  const isSecure = serverUrl.protocol === 'https:' || serverUrl.protocol === 'wss:';

  serverUrl.protocol = isSecure ? 'wss:' : 'ws:';
  serverUrl.pathname = '';
  serverUrl.search = '';
  serverUrl.hash = '';

  return serverUrl.toString().replace(/\/$/, "");
};

// --- ICE Configuration ---

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type IceServerOptions = {
  iceServers?: IceServer[] | null;
};

const splitUrls = (raw?: string | null) =>
  (raw || '')
    .split(/[,\\s]+/)
    .map((url) => url.trim())
    .filter(Boolean);

const parseIceServersFromEnv = (): IceServer[] | null => {
  const explicitIceServers = import.meta.env.VITE_ICE_SERVERS;
  if (explicitIceServers) {
    try {
      const parsed = JSON.parse(explicitIceServers);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as IceServer[];
    } catch (e) {
      console.error('Failed to parse VITE_ICE_SERVERS from .env', e);
    }
  }

  const stunUrls = splitUrls(import.meta.env.VITE_STUN_URLS);
  const turnUrls = splitUrls(import.meta.env.VITE_TURN_URLS);
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_PASSWORD || import.meta.env.VITE_TURN_CREDENTIAL;

  const derived: IceServer[] = [];
  if (stunUrls.length) derived.push({ urls: stunUrls });
  if (turnUrls.length) {
    derived.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return derived.length ? derived : null;
};

export const resolveIceServers = (options?: IceServerOptions) => {
  if (options?.iceServers && options.iceServers.length) return options.iceServers;

  const envServers = parseIceServersFromEnv();
  if (envServers?.length) return envServers;

  return DEFAULT_ICE_SERVERS;
};

export const getRtcConfig = (options?: IceServerOptions): RTCConfiguration => ({
  iceServers: resolveIceServers(options),
});
