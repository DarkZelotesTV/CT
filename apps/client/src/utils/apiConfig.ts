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

// --- LiveKit dynamic configuration persistence ---

export const setLiveKitUrl = (livekitUrl?: string | null) => {
  const trimmed = livekitUrl?.trim();

  if (trimmed) {
    storage.set('livekitUrl', trimmed);
  } else {
    storage.remove('livekitUrl');
  }
};

export const resetServerSettings = () => {
  storage.remove('cloverServerUrl');
  storage.remove('cloverServerPassword');
  storage.remove('livekitUrl');
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

// --- LiveKit Configuration ---

// Standard STUN-Server
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const getLiveKitConfig = () => {
  // ICE Server Konfiguration laden (gilt für beide Varianten)
  let iceServers = DEFAULT_ICE_SERVERS;
  const envIceServers = import.meta.env.VITE_ICE_SERVERS;

  if (envIceServers) {
    try {
      const parsed = JSON.parse(envIceServers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        iceServers = parsed;
      }
    } catch (e) {
      console.error("Failed to parse VITE_ICE_SERVERS from .env", e);
    }
  }

  const serverUrl = getServerUrlObject();
  const isSecure = serverUrl.protocol === 'https:' || serverUrl.protocol === 'wss:';
  const wsProtocol = isSecure ? 'wss:' : 'ws:';

  const normalizeLivekitUrl = (rawUrl: string): string | null => {
    try {
      const parsed = new URL(rawUrl);

      if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
      else if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
      else if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') parsed.protocol = wsProtocol;

      parsed.pathname = parsed.pathname || '/';
      return parsed.toString().replace(/\/$/, "");
    } catch (error) {
      console.warn('Failed to parse LiveKit URL from server, falling back to default.', error);
      return null;
    }
  };

  const buildConfig = (url: string) => ({
    serverUrl: url,
    connectOptions: {
      rtcConfig: {
        iceServers,
      },
    },
  });

  // 1. NEU: Prüfen, ob wir eine dynamische URL vom Server erhalten haben
  // Diese hat die allerhöchste Priorität!
  const dynamicUrl = storage.get('livekitUrl');

  if (dynamicUrl && dynamicUrl.trim() !== "") {
    const normalized = normalizeLivekitUrl(dynamicUrl.trim());
    if (normalized) {
      return buildConfig(normalized);
    }
  }

  // 2. Fallback: Alte Logik (Environment Variable oder Server-Host Ableitung)
  let url = import.meta.env.VITE_LIVEKIT_URL;
  const fallbackUrl = `${wsProtocol}//${serverUrl.hostname}:7880`;

  if (url) {
    try {
      const resolved = new URL(url, `${wsProtocol}//${serverUrl.host}`).toString();
      url = normalizeLivekitUrl(resolved) || fallbackUrl;
    } catch (error) {
      console.error('Failed to parse VITE_LIVEKIT_URL, falling back to server host.', error);
      url = fallbackUrl;
    }
  } else {
    url = fallbackUrl;
    // Warnung nur lokal interessant
    // console.warn(`VITE_LIVEKIT_URL not set. Defaulting to ${url}`);
  }

  return buildConfig(url);
};
