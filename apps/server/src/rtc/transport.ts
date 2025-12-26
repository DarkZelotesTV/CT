import type { TransportListenIp } from 'mediasoup/node/lib/types';

export type WebRtcTransportDefaults = {
  listenIps: TransportListenIp[];
  enableUdp: boolean;
  enableTcp: boolean;
  initialAvailableOutgoingBitrate?: number;
};

const parseListenIpEntry = (entry: string): TransportListenIp | null => {
  const trimmed = entry.trim();
  if (!trimmed) return null;

  // Unterstützt Formate wie "0.0.0.0", "0.0.0.0/203.0.113.1" oder "0.0.0.0|203.0.113.1".
  const [ip, announcedIp] = trimmed.split(/[\/|]/).map((part) => part.trim());
  if (!ip) return null;

  const listenIp: TransportListenIp = { ip };
  if (announcedIp) listenIp.announcedIp = announcedIp;

  return listenIp;
};

const parseListenIps = (raw?: string | null): TransportListenIp[] => {
  const normalized = raw?.trim();
  if (!normalized) return [];

  if (normalized.startsWith('[')) {
    try {
      const parsed = JSON.parse(normalized) as { ip: string; announcedIp?: string }[];
      return parsed
        .map((item) => (item?.ip ? ({ ip: item.ip, ...(item.announcedIp ? { announcedIp: item.announcedIp } : {}) } as TransportListenIp) : null))
        .filter((ip): ip is TransportListenIp => Boolean(ip));
    } catch (err) {
      console.warn('⚠️ Konnte RTC_LISTEN_IPS nicht als JSON parsen, falle zurück auf CSV', err);
    }
  }

  return normalized
    .split(/[,;]+/)
    .map((entry) => parseListenIpEntry(entry))
    .filter((ip): ip is TransportListenIp => Boolean(ip));
};

const parseBoolean = (raw: string | undefined, fallback: boolean) => {
  if (typeof raw === 'undefined') return fallback;
  if (raw === '1') return true;
  if (raw === '0') return false;
  const lowered = raw.toLowerCase();
  if (['true', 'yes', 'y', 'on'].includes(lowered)) return true;
  if (['false', 'no', 'n', 'off'].includes(lowered)) return false;
  return fallback;
};

const parseNumber = (raw: string | undefined) => {
  if (typeof raw === 'undefined') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveListenIpsFromEnv = (): TransportListenIp[] => {
  const envValue = process.env.RTC_LISTEN_IPS || process.env.MEDIASOUP_LISTEN_IPS || process.env.RTC_LISTEN_IP || null;
  const parsed = parseListenIps(envValue);
  if (parsed.length) return parsed;
  return [{ ip: '0.0.0.0' }];
};

export const resolveWebRtcTransportDefaults = (overrides?: Partial<WebRtcTransportDefaults>): WebRtcTransportDefaults => {
  const listenIps = overrides?.listenIps?.length ? overrides.listenIps : resolveListenIpsFromEnv();
  const enableUdp = typeof overrides?.enableUdp === 'boolean' ? overrides.enableUdp : parseBoolean(process.env.RTC_ENABLE_UDP, true);
  const enableTcp = typeof overrides?.enableTcp === 'boolean' ? overrides.enableTcp : parseBoolean(process.env.RTC_ENABLE_TCP, true);
  const initialAvailableOutgoingBitrate =
    typeof overrides?.initialAvailableOutgoingBitrate !== 'undefined'
      ? overrides.initialAvailableOutgoingBitrate
      : parseNumber(process.env.RTC_INITIAL_AVAILABLE_OUTGOING_BITRATE);

  return {
    listenIps,
    enableUdp,
    enableTcp,
    initialAvailableOutgoingBitrate,
  };
};
