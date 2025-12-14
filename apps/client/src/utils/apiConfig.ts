const SERVER_PASSWORD_KEY = 'clover_server_password';

const getAppOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
};

const getDefaultServerUrl = () => {
  // Wenn keine Server-URL gesetzt ist, verwenden wir die Herkunft der geladenen App.
  // So verbindet sich der Client automatisch mit der Instanz, von der aus er aufgerufen wurde.
  return getAppOrigin() || 'http://localhost:3001';
};

export const getServerUrl = (): string => {
  const stored = localStorage.getItem('clover_server_url');
  const url = (stored && stored.trim()) || getDefaultServerUrl();

  return url.trim().replace(/\/$/, "");
};

export const setServerUrl = (url: string) => {
  localStorage.setItem('clover_server_url', url.trim());
};

export const getServerPassword = (): string => {
  return localStorage.getItem(SERVER_PASSWORD_KEY) || '';
};

export const setServerPassword = (password: string) => {
  localStorage.setItem(SERVER_PASSWORD_KEY, password);
};

// --- URL Helpers ---

const asUrl = (url: string) => new URL(url);

const normalizeServerUrl = (rawUrl: string) => {
  const sanitizedUrl = rawUrl.trim();

  try {
    return asUrl(sanitizedUrl);
  } catch (_err) {
    // Allow users to omit the protocol (e.g. "example.com" or "10.0.0.5:3001").
    // Default to the protocol of the loaded app (falls back to HTTP if unavailable)
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

// Standard STUN-Server, damit Verbindungen auch ohne eigene Config meistens klappen
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const getLiveKitConfig = () => {
  // 1. URL aus Environment oder Fallback basierend auf der ausgewählten Server-URL
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
    console.warn(`VITE_LIVEKIT_URL not set. Defaulting to ${url}`);
  }

  // 2. ICE Server Konfiguration laden
  // Erlaubt das Überschreiben via .env (z.B. für eigene TURN Server)
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

  return {
    serverUrl: url,
    connectOptions: {
      rtcConfig: {
        iceServers: iceServers,
      },
    },
  };
};