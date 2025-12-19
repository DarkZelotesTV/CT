import { storage } from '../shared/config/storage';

const getAppOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
};

export const getDefaultServerUrl = () => {
  // Wenn keine Server-URL gesetzt ist, verwenden wir die Herkunft der geladenen App.
  return getAppOrigin() || 'http://localhost:3001';
};

export const getServerUrl = (): string => {
  const stored = storage.get('cloverServerUrl');
  const url = (stored && stored.trim()) || getDefaultServerUrl();

  return url.trim().replace(/\/$/, "");
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
};

// --- URL Helpers ---

const asUrl = (url: string) => new URL(url);

const normalizeServerUrl = (rawUrl: string) => {
  const sanitizedUrl = rawUrl.trim();

  try {
    return asUrl(sanitizedUrl);
  } catch (_err) {
    const fallbackProtocol = (typeof window !== "undefined" && window.location?.protocol) || 'http:';
    try {
      return asUrl(`${fallbackProtocol}//${sanitizedUrl}`);
    } catch (error) {
      const fallback = getDefaultServerUrl();
      console.error('Invalid server URL configured, falling back to app origin.', error);
      return asUrl(fallback);
    }
  }
};

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

  // 1. NEU: Prüfen, ob wir eine dynamische URL vom Server erhalten haben
  // Diese hat die allerhöchste Priorität!
  const dynamicUrl = storage.get('livekitUrl');
  
  if (dynamicUrl && dynamicUrl.trim() !== "") {
    return {
      serverUrl: dynamicUrl,
      connectOptions: {
        rtcConfig: {
          iceServers: iceServers,
        },
      },
    };
  }

  // 2. Fallback: Alte Logik (Environment Variable oder Server-Host Ableitung)
  let url = import.meta.env.VITE_LIVEKIT_URL;
  const serverUrl = getServerUrlObject();
  const isSecure = serverUrl.protocol === 'https:' || serverUrl.protocol === 'wss:';
  const wsProtocol = isSecure ? 'wss:' : 'ws:';

  const fallbackUrl = `${wsProtocol}//${serverUrl.hostname}:7880`;

  if (url) {
    try {
      url = new URL(url, `${wsProtocol}//${serverUrl.host}`).toString();
    } catch (error) {
      console.error('Failed to parse VITE_LIVEKIT_URL, falling back to server host.', error);
      url = fallbackUrl;
    }
  } else {
    url = fallbackUrl;
    // Warnung nur lokal interessant
    // console.warn(`VITE_LIVEKIT_URL not set. Defaulting to ${url}`);
  }

  return {
    serverUrl: url,
    connectOptions: {
      rtcConfig: {
        iceServers: iceServers,
      },
    },
  };
};