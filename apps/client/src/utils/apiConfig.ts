export const DEFAULT_SERVER = 'http://localhost:3001';

export const getServerUrl = (): string => {
  let url = localStorage.getItem('clover_server_url') || DEFAULT_SERVER;
  return url.replace(/\/$/, "");
};

export const setServerUrl = (url: string) => {
  localStorage.setItem('clover_server_url', url);
};

// --- LiveKit Configuration ---

// Standard STUN-Server, damit Verbindungen auch ohne eigene Config meistens klappen
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const getLiveKitConfig = () => {
  // 1. URL aus Environment oder Fallback
  let url = import.meta.env.VITE_LIVEKIT_URL;
  
  if (!url) {
    // Intelligenter Fallback basierend auf dem aktuellen Host
    const isSecure = window.location.protocol === 'https:';
    const host = window.location.hostname;
    const protocol = isSecure ? 'wss:' : 'ws:';
    // Wenn wir lokal entwickeln, nehmen wir localhost:7880, sonst raten wir eine Standard-URL
    url = (host === 'localhost' || host === '127.0.0.1') 
      ? "ws://localhost:7880" 
      : `${protocol}//${host}:7880`;
    
    console.warn(`VITE_LIVEKIT_URL not set. Defaulting to ${url}`);
  }

  // 2. Security Upgrade: Erzwinge WSS wenn die Seite über HTTPS läuft
  if (window.location.protocol === 'https:' && url.startsWith('ws:')) {
    console.log("Upgrading LiveKit URL to WSS for secure context");
    url = url.replace('ws:', 'wss:');
  }

  // 3. ICE Server Konfiguration laden
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