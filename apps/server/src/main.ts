import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // <--- WICHTIG: Import hinzugefügt
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Server } from 'socket.io';
import { sequelize } from './config/database';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from './utils/paths';

// Routen Importe
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import friendsRoutes from './routes/friends';
import {
  userChannelMemberships,
  registerUserSocket,
  removeUserFromAllChannels,
  removeUserFromChannel,
  getUserChannelIds,
  getSocketsForUser,
  unregisterUserSocket,
} from './realtime/registry';

// Models Importe (für Socket Logik)
import type { Consumer as MediasoupConsumer, MediaKind, Producer as MediasoupProducer, Router as MediasoupRouter, RtpCapabilities, RtpParameters, WebRtcTransport } from 'mediasoup/node/lib/types';
import { User, ServerMember, MemberRole, Role, Channel } from './models';
import { resolveUserFromIdentity } from './utils/identityAuth';
import {
  resolveProducerPreset,
  resolveWebRtcTransportDefaults,
  rtcRoomManager,
  rtcWorkerPool,
  type ProducerPresetName,
  type RtcTransportDirection,
  type WebRtcTransportDefaults,
} from './rtc';
import { cleanupRtcResources, parseChannelIdFromRoomName, rtcRoomNameForChannel } from './realtime/rtcModeration';
import {
  channelIdSchema,
  requestServerMembersSchema,
  rtcConnectTransportSchema,
  rtcConsumeSchema,
  rtcCreateTransportSchema,
  rtcJoinRoomSchema,
  rtcPauseConsumerSchema,
  rtcProduceSchema,
  rtcResumeConsumerSchema,
  rtcTransportDefaultsSchema,
  p2pJoinSchema,
  p2pSignalSchema,
  p2pOfferAnswerSchema,
  p2pCandidateSchema,
} from './realtime/socketSchemas';
import { createDefaultTokenBucket, TokenBucket } from './realtime/rateLimiter';
import type { ZodTypeAny } from 'zod';

const PORT = Number(process.env.PORT || 3001);
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || process.env.HTTPS_CERT_PATH;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || process.env.HTTPS_KEY_PATH;
const TLS_CA_PATH = process.env.TLS_CA_PATH;
const TLS_PASSPHRASE = process.env.TLS_PASSPHRASE;
const TLS_DHPARAM_PATH = process.env.TLS_DHPARAM_PATH;
const configuredCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultCorsOrigins = [
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedHttpOrigins = configuredCorsOrigins.length ? configuredCorsOrigins : defaultCorsOrigins;
const allowedSocketOrigins = Array.from(
  new Set([
    ...allowedHttpOrigins,
    ...allowedHttpOrigins
      .filter((origin) => origin.startsWith('http://') || origin.startsWith('https://'))
      .map((origin) => origin.replace(/^http/, 'ws')),
  ]),
);

const allowOrigin = (origin: string | undefined, allowed: string[]) => {
  if (!origin || allowed.length === 0) return true;
  return allowed.some((allowedOrigin) => origin === allowedOrigin);
};

type TlsCredentials = {
  key: Buffer;
  cert: Buffer;
  keyPath: string;
  certPath: string;
  passphrase?: string;
  ca?: Buffer;
  caPath?: string;
  dhparam?: Buffer;
  dhparamPath?: string;
};

const readTlsFile = (envName: string, filePath: string) => {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.warn(`⚠️ ${envName} is misconfigured: file not found at ${resolved}.`);
    return null;
  }

  try {
    return { path: resolved, contents: fs.readFileSync(resolved) };
  } catch (err) {
    console.warn(`⚠️ ${envName} is misconfigured: unable to read file at ${resolved}.`, err);
    return null;
  }
};

const loadTlsCredentials = (): TlsCredentials | null => {
  const hasAnyTlsConfig = Boolean(TLS_CERT_PATH || TLS_KEY_PATH || TLS_CA_PATH || TLS_DHPARAM_PATH || TLS_PASSPHRASE);

  if (!TLS_CERT_PATH && !TLS_KEY_PATH) {
    if (hasAnyTlsConfig) {
      if (!TLS_CERT_PATH) {
        console.warn('⚠️ TLS_CERT_PATH is required but not set. Configure TLS_CERT_PATH alongside TLS_KEY_PATH.');
      }
      if (!TLS_KEY_PATH) {
        console.warn('⚠️ TLS_KEY_PATH is required but not set. Configure TLS_KEY_PATH alongside TLS_CERT_PATH.');
      }
    } else {
      console.warn('ℹ️ No TLS certificate/key configured. Set TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS.');
    }
    return null;
  }

  if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
    if (!TLS_CERT_PATH) {
      console.warn('⚠️ TLS_CERT_PATH is required but not set. Configure TLS_CERT_PATH alongside TLS_KEY_PATH.');
    }
    if (!TLS_KEY_PATH) {
      console.warn('⚠️ TLS_KEY_PATH is required but not set. Configure TLS_KEY_PATH alongside TLS_CERT_PATH.');
    }
    return null;
  }

  const certFile = readTlsFile('TLS_CERT_PATH', TLS_CERT_PATH);
  const keyFile = readTlsFile('TLS_KEY_PATH', TLS_KEY_PATH);

  if (!certFile || !keyFile) {
    return null;
  }

  let caFile: ReturnType<typeof readTlsFile> | null = null;
  if (TLS_CA_PATH) {
    caFile = readTlsFile('TLS_CA_PATH', TLS_CA_PATH);
    if (!caFile) {
      return null;
    }
  }

  let dhparamFile: ReturnType<typeof readTlsFile> | null = null;
  if (TLS_DHPARAM_PATH) {
    dhparamFile = readTlsFile('TLS_DHPARAM_PATH', TLS_DHPARAM_PATH);
    if (!dhparamFile) {
      return null;
    }
  }

  return {
    cert: certFile.contents,
    key: keyFile.contents,
    certPath: certFile.path,
    keyPath: keyFile.path,
    passphrase: TLS_PASSPHRASE || undefined,
    ca: caFile?.contents,
    caPath: caFile?.path,
    dhparam: dhparamFile?.contents,
    dhparamPath: dhparamFile?.path,
  };
};

const app = express();
const tlsCredentials = loadTlsCredentials();
const httpServer = tlsCredentials
  ? createHttpsServer(
    {
      key: tlsCredentials.key,
      cert: tlsCredentials.cert,
      ca: tlsCredentials.ca,
      dhparam: tlsCredentials.dhparam,
      passphrase: tlsCredentials.passphrase,
    },
    app,
  )
  : createHttpServer(app);
const serverProtocol = tlsCredentials ? 'https' : 'http';
const websocketProtocol = tlsCredentials ? 'wss' : 'ws';

if (tlsCredentials) {
  console.log('🔒 TLS enabled. Using HTTPS server.');
  console.log(`   - Certificate: ${tlsCredentials.certPath}`);
  console.log(`   - Key:         ${tlsCredentials.keyPath}`);
  if (tlsCredentials.caPath) {
    console.log(`   - CA bundle:   ${tlsCredentials.caPath}`);
  }
  if (tlsCredentials.dhparamPath) {
    console.log(`   - DH params:   ${tlsCredentials.dhparamPath}`);
  }
} else {
  console.warn('⚠️ Running without TLS. HTTPS/WebSocket secure endpoints will not be available.');
}
const HEARTBEAT_INTERVAL_MS = 15_000;
const OFFLINE_GRACE_MS = 30_000;
const offlineTimers = new Map<number, NodeJS.Timeout>();

const clearOfflineTimer = (userId: number) => {
  const existing = offlineTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    offlineTimers.delete(userId);
  }
};

const markUserOffline = async (userId: number) => {
  clearOfflineTimer(userId);

  removeUserFromAllChannels(userId);

  try {
    await User.update({ status: 'offline' }, { where: { id: userId } });
    io.emit('user_status_change', { userId, status: 'offline' });
  } catch (err) {
    console.error("Fehler beim Setzen des Offline-Status:", err);
  }
};

const scheduleOfflineCheck = (userId: number) => {
  clearOfflineTimer(userId);
  offlineTimers.set(userId, setTimeout(() => markUserOffline(userId), OFFLINE_GRACE_MS));
};

const sendPresenceSnapshot = async (socket: any) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username', 'avatar_url', 'status'] });
    socket.emit('presence_snapshot', { users });
  } catch (err) {
    console.error('Fehler beim Senden des Presence-Snapshots:', err);
  }
};

const rtcRouters = new Map<number, MediasoupRouter>();
const p2pVoiceRooms = new Map<number, Set<number>>();

const buildP2pPeerSummary = (user: User) => ({
  userId: user.id,
  username: user.username,
  avatarUrl: user.avatar_url,
});
const closeRtcRouterForChannel = (channelId: number) => {
  const router = rtcRouters.get(channelId);
  if (router) {
    rtcRouters.delete(channelId);
    if (!router.closed) {
      try {
        router.close();
      } catch (err) {
        console.warn(`[RTC] Fehler beim Schließen des Routers für channel_${channelId}:`, err);
      }
    }
  }

  if (rtcRouters.size === 0) {
    void rtcWorkerPool.close();
  }
};

const getOrCreateRtcRouter = async (channelId: number) => {
  const existing = rtcRouters.get(channelId);
  if (existing && !existing.closed) return existing;

  const router = await rtcWorkerPool.createRouter();
  rtcRouters.set(channelId, router);

  (router.observer as any).on('close', () => {
    if (rtcRouters.get(channelId) === router) {
      rtcRouters.delete(channelId);
    }
  });

  return router;
};
rtcRoomManager.setRoomEmptyHandler((roomName) => {
  const channelId = parseChannelIdFromRoomName(roomName);
  if (channelId !== null) {
    closeRtcRouterForChannel(channelId);
  }
});

const listActiveP2pPeers = async (channelId: number) => {
  const peers = Array.from(p2pVoiceRooms.get(channelId) || []);
  if (!peers.length) return [];
  const users = await User.findAll({ where: { id: peers }, attributes: ['id', 'username', 'avatar_url'] });
  return users.map((user) => buildP2pPeerSummary(user));
};

const removeFromP2pRoom = (channelId: number, userId: number, originSocket?: any) => {
  if (originSocket) {
    const socketChannels: Set<number> = (originSocket.data as any).p2pChannels || new Set<number>();
    socketChannels.delete(channelId);
    (originSocket.data as any).p2pChannels = socketChannels;
  }

  const sockets = getSocketsForUser(userId);
  const hasOtherSockets = Array.from(sockets).some((sock: any) => sock !== originSocket && (sock.data as any)?.p2pChannels?.has(channelId));
  if (hasOtherSockets) return;

  const participants = p2pVoiceRooms.get(channelId);
  if (!participants) return;

  const wasMember = participants.delete(userId);
  if (!participants.size) {
    p2pVoiceRooms.delete(channelId);
  }

  if (wasMember) {
    io.to(`channel_${channelId}`).emit('p2p:peer-left', { channelId, peerId: userId });
  }
};

const ensureVoiceChannelAccess = async (channelId: number, userId: number) => {
  if (!Number.isFinite(channelId) || channelId <= 0) {
    throw new Error('Ungültige channelId');
  }

  const channel = await Channel.findByPk(channelId);
  if (!channel) {
    throw new Error('Kanal nicht gefunden');
  }
  if (channel.type !== 'voice') {
    throw new Error('Kanal ist kein Voice-Channel');
  }

  const membership = await ServerMember.findOne({ where: { server_id: channel.server_id, user_id: userId } });
  if (!membership) {
    throw new Error('Fehlende Berechtigung');
  }

  return channel;
};

const parsePayload = <S extends ZodTypeAny>(schema: S, payload: unknown) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ') || 'Ungültige Daten';
    throw new Error(message);
  }
  return result.data;
};

const consumeTokenOrThrow = (socket: any) => {
  const limiter: TokenBucket = (socket.data as any).rateLimiter || createDefaultTokenBucket();
  (socket.data as any).rateLimiter = limiter;
  if (!limiter.tryRemoveToken()) {
    throw new Error('Rate limit exceeded');
  }
};

// ==========================================
// 1. CORS & MIDDLEWARE (Sicherheit lockern)
// ==========================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Erlaubt Skripte und Styles (oft nötig für Dev-Tools/Vite)
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:", "https:", "blob:"],
        'connect-src': [
          "'self'",
          `${serverProtocol}:`,
          `${websocketProtocol}:`,
          ...allowedHttpOrigins,
          ...allowedSocketOrigins,
        ],
        // WICHTIG: Hier erlauben wir die Codenames-Seite im Iframe
        'frame-src': ["'self'", "https://codenames.game/"],
      },
    },
    // Deaktiviert COEP, falls es Probleme beim Laden von Ressourcen gibt
    crossOriginEmbedderPolicy: false,
    // Erlaubt Laden von Ressourcen über Origins hinweg (hilfreich im Dev-Mode)
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(cors({
  origin: (origin, callback) => {
    if (allowOrigin(origin, allowedHttpOrigins)) {
      return callback(null, true);
    }
    console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true // Erlaubt Cookies/Authorization Header
}));

app.use(express.json());
const uploadRoot = UPLOADS_DIR;
fs.promises.mkdir(uploadRoot, { recursive: true }).catch(() => {});
app.use('/uploads', express.static(uploadRoot));

// ==========================================
// 2. SOCKET.IO SETUP
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (allowOrigin(origin, allowedSocketOrigins)) {
        return callback(null, true);
      }
      console.warn(`🚫 Blocked Socket.IO connection from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 3. API ROUTEN REGISTRIEREN
// ==========================================
app.use('/api/auth', authRoutes);       // Identity handshake
app.use('/api', dataRoutes);            // Server, Channels, Members
app.use('/api', friendsRoutes);

// ==========================================
// 4. ECHTZEIT LOGIK (Socket.io)
// ==========================================

io.use(async (socket, next) => {
  try {
    const identity = (socket.handshake as any).auth || {};
    const { user, fingerprint } = await resolveUserFromIdentity({
      fingerprint: identity.fingerprint,
      publicKeyB64: identity.publicKey,
      displayName: identity.displayName,
      serverPassword: identity.serverPassword,
      signatureB64: identity.signature,
      timestamp: identity.timestamp ? Number(identity.timestamp) : null,
    });

    (socket.data as any).userId = user.id;
    (socket.data as any).fingerprint = fingerprint;
    next();
  } catch (err: any) {
    next(new Error(err?.message || 'unauthorized'));
  }
});

io.on('connection', async (socket) => {
  const userId = (socket.data as any).userId;
  const numericUserId = userId ? Number(userId) : null;
  (socket.data as any).joinedChannels = new Set<number>();
  (socket.data as any).p2pChannels = new Set<number>();
  (socket.data as any).heartbeatInterval = null;
  (socket.data as any).presenceSnapshotInterval = null;
  (socket.data as any).rtcTransportDefaults = resolveWebRtcTransportDefaults();
  (socket.data as any).rtcRooms = new Set<string>();
  (socket.data as any).rtcTransports = new Map<string, WebRtcTransport>();
  (socket.data as any).rtcConsumers = new Map<string, MediasoupConsumer>();
  (socket.data as any).rtcProducers = new Map<string, MediasoupProducer>();
  (socket.data as any).rateLimiter = createDefaultTokenBucket();

  if (numericUserId) {
     console.log(`User ${numericUserId} connected (Socket ID: ${socket.id})`);

     try {
       clearOfflineTimer(numericUserId);
       await User.update({ status: 'online' }, { where: { id: numericUserId } });
       io.emit('user_status_change', { userId: numericUserId, status: 'online' });
       scheduleOfflineCheck(numericUserId);
       await sendPresenceSnapshot(socket);
       registerUserSocket(numericUserId, socket);
     } catch (err) {
       console.error("Fehler beim Setzen des Online-Status:", err);
     }

     (socket.data as any).heartbeatInterval = setInterval(() => {
       socket.emit('presence_ping');
     }, HEARTBEAT_INTERVAL_MS);

     (socket.data as any).presenceSnapshotInterval = setInterval(() => {
       sendPresenceSnapshot(socket);
     }, HEARTBEAT_INTERVAL_MS * 2);
  }

  socket.on('presence_ack', () => {
    if (!numericUserId) return;
    scheduleOfflineCheck(numericUserId);
  });

  socket.on(
    'rtc:transport-defaults',
    (ack?: (payload: { success: boolean; defaults?: WebRtcTransportDefaults; error?: string }) => void) => {
      try {
        consumeTokenOrThrow(socket);
        parsePayload(rtcTransportDefaultsSchema, undefined);
        const defaults = (socket.data as any).rtcTransportDefaults || resolveWebRtcTransportDefaults();
        (socket.data as any).rtcTransportDefaults = defaults;
        if (typeof ack === 'function') ack({ success: true, defaults });
      } catch (err: any) {
        console.error('Fehler beim Auflösen der RTC-Transport-Defaults:', err);
        if (typeof ack === 'function') ack({ success: false, error: err?.message || 'Unbekannter Fehler' });
      }
    }
  );

  socket.on(
    'rtc:createTransport',
    async (
      payload: { channelId?: number; direction?: RtcTransportDirection },
      ack?: (payload: {
        success: boolean;
        error?: string;
        transport?: {
          id: string;
          direction: RtcTransportDirection;
          iceParameters: WebRtcTransport['iceParameters'];
          iceCandidates: WebRtcTransport['iceCandidates'];
          dtlsParameters: WebRtcTransport['dtlsParameters'];
          sctpParameters?: WebRtcTransport['sctpParameters'];
        };
      }) => void
    ) => {
      const respond = (body: {
        success: boolean;
        error?: string;
        transport?: {
          id: string;
          direction: RtcTransportDirection;
          iceParameters: WebRtcTransport['iceParameters'];
          iceCandidates: WebRtcTransport['iceCandidates'];
          dtlsParameters: WebRtcTransport['dtlsParameters'];
          sctpParameters?: WebRtcTransport['sctpParameters'];
        };
      }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { channelId, direction } = parsePayload(rtcCreateTransportSchema, payload);

        await ensureVoiceChannelAccess(channelId, numericUserId);

        const defaults = (socket.data as any).rtcTransportDefaults || resolveWebRtcTransportDefaults();
        (socket.data as any).rtcTransportDefaults = defaults;
        const router = await getOrCreateRtcRouter(channelId);
        const transport = await router.createWebRtcTransport({
          listenIps: defaults.listenIps,
          enableUdp: defaults.enableUdp,
          enableTcp: defaults.enableTcp,
          initialAvailableOutgoingBitrate: defaults.initialAvailableOutgoingBitrate,
          appData: {
            channelId,
            direction,
            participantId: numericUserId,
            socketId: socket.id,
          },
        });

        const rtcTransports: Map<string, WebRtcTransport> = (socket.data as any).rtcTransports || new Map();
        rtcTransports.set(transport.id, transport);
        (socket.data as any).rtcTransports = rtcTransports;

        (transport as any).on('close', () => rtcTransports.delete(transport.id));
        transport.on('routerclose', () => rtcTransports.delete(transport.id));

        const roomName = rtcRoomNameForChannel(channelId);
        rtcRoomManager.createTransport(roomName, String(numericUserId), direction, { transportId: transport.id }, transport.id);

        respond({
          success: true,
          transport: {
            id: transport.id,
            direction,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
          },
        });
      } catch (err: any) {
        console.error('Fehler bei rtc:createTransport:', err);
        respond({ success: false, error: err?.message || 'Konnte RTC-Transport nicht erstellen' });
      }
    }
  );

  socket.on(
    'rtc:connectTransport',
    async (
      payload: { transportId?: string; dtlsParameters?: WebRtcTransport['dtlsParameters'] },
      ack?: (payload: { success: boolean; error?: string }) => void
    ) => {
      const respond = (body: { success: boolean; error?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { transportId, dtlsParameters } = parsePayload(rtcConnectTransportSchema, payload);

        const rtcTransports: Map<string, WebRtcTransport> = (socket.data as any).rtcTransports || new Map();
        const transport = rtcTransports.get(transportId);

        if (!transport) {
          return respond({ success: false, error: 'Transport nicht gefunden' });
        }

        if (transport.appData?.participantId && transport.appData.participantId !== numericUserId) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Transport' });
        }

        await transport.connect({ dtlsParameters });

        const channelId = transport.appData?.channelId;
        if (Number.isFinite(channelId)) {
          const roomName = rtcRoomNameForChannel(Number(channelId));
          rtcRoomManager.markTransportConnected(roomName, String(numericUserId), transport.id);
        }

        respond({ success: true });
      } catch (err: any) {
        console.error('Fehler bei rtc:connectTransport:', err);
        respond({ success: false, error: err?.message || 'Konnte RTC-Transport nicht verbinden' });
      }
    }
  );

  socket.on(
    'rtc:produce',
    async (
      payload: { channelId?: number; transportId?: string; rtpParameters?: RtpParameters; appData?: Record<string, any> },
      ack?: (payload: { success: boolean; error?: string; producerId?: string }) => void
    ) => {
      const respond = (body: { success: boolean; error?: string; producerId?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { channelId, transportId, rtpParameters, appData } = parsePayload(rtcProduceSchema, payload);

        await ensureVoiceChannelAccess(channelId, numericUserId);

        const rtcTransports: Map<string, WebRtcTransport> = (socket.data as any).rtcTransports || new Map();
        const transport = rtcTransports.get(transportId);
        if (!transport) {
          return respond({ success: false, error: 'Transport nicht gefunden' });
        }

        if (transport.appData?.participantId && transport.appData.participantId !== numericUserId) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Transport' });
        }

        if (transport.appData?.direction && transport.appData.direction !== 'send') {
          return respond({ success: false, error: 'Transport ist nicht zum Senden vorgesehen' });
        }

        const roomName = rtcRoomNameForChannel(channelId);
        const rtcRooms: Set<string> = (socket.data as any).rtcRooms || new Set<string>();
        if (!rtcRooms.has(roomName)) {
          return respond({ success: false, error: 'Nicht im RTC-Raum' });
        }

        const isValidPreset = (value: unknown): value is ProducerPresetName =>
          typeof value === 'string' && ['voice', 'high', 'music'].includes(value);
        const requestedPreset: ProducerPresetName | null = isValidPreset(appData?.audioPreset) ? appData?.audioPreset : null;
        const preset = resolveProducerPreset(requestedPreset);
        const participantIdentity = String(numericUserId);

        // mediasoup: maxBitrate gehört in rtpParameters.encodings, nicht in ProducerOptions
        if (typeof preset.maxBitrate === 'number' && preset.maxBitrate > 0) {
          const encodings = (rtpParameters as any).encodings?.length ? (rtpParameters as any).encodings : [{}];
          (rtpParameters as any).encodings = encodings.map((encoding: any) => ({
            ...encoding,
            maxBitrate: preset.maxBitrate,
          }));
        }

        const producerOptions: any = {
          kind: 'audio',
          rtpParameters,
          appData: {
            ...(appData || {}),
            audioPreset: requestedPreset ?? 'voice',
            channelId,
            participantId: numericUserId,
            socketId: socket.id,
            kind: 'audio',
          },
        };

        // mediasoup typings in this version omit codecOptions, but the runtime supports it
        if (preset.codecOptions) {
          producerOptions.codecOptions = preset.codecOptions;
        }

        const producer = await transport.produce(producerOptions);

        const rtcProducers: Map<string, MediasoupProducer> = (socket.data as any).rtcProducers || new Map();
        rtcProducers.set(producer.id, producer);
        (socket.data as any).rtcProducers = rtcProducers;

        rtcRoomManager.upsertProducer(roomName, String(numericUserId), producer.id, {
          transportId: transport.id,
          kind: 'audio',
          appData: producer.appData as Record<string, any>,
        });

        const participant = rtcRoomManager.listParticipants(roomName).find((peer) => peer.identity === participantIdentity);

        if (participant) {
          io.to(roomName).emit('rtc:newProducer', { roomName, channelId, peer: participant });
        }

        let closedNotified = false;
        const notifyProducerClosed = () => {
          if (closedNotified) return;
          closedNotified = true;

          rtcRoomManager.removeProducer(roomName, participantIdentity, producer.id);
          rtcProducers.delete(producer.id);
          const updatedPeer = rtcRoomManager.listParticipants(roomName).find((peer) => peer.identity === participantIdentity);
          io.to(roomName).emit('producerClosed', { roomName, channelId, producerId: producer.id, peer: updatedPeer });
        };

        producer.on('transportclose', notifyProducerClosed);
        producer.observer.on('close', notifyProducerClosed);

        respond({ success: true, producerId: producer.id });
      } catch (err: any) {
        console.error('Fehler bei rtc:produce:', err);
        respond({ success: false, error: err?.message || 'Konnte Producer nicht erstellen' });
      }
    }
  );

  socket.on(
    'rtc:consume',
    async (
      payload: { channelId?: number; transportId?: string; producerId?: string; rtpCapabilities?: RtpCapabilities; appData?: Record<string, any> },
      ack?: (payload: { success: boolean; error?: string; consumer?: { id: string; producerId: string; kind: MediaKind; rtpParameters: RtpParameters } }) => void
    ) => {
      const respond = (body: { success: boolean; error?: string; consumer?: { id: string; producerId: string; kind: MediaKind; rtpParameters: RtpParameters } }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { channelId, transportId, producerId, rtpCapabilities, appData } = parsePayload(rtcConsumeSchema, payload);

        await ensureVoiceChannelAccess(channelId, numericUserId);

        const rtcTransports: Map<string, WebRtcTransport> = (socket.data as any).rtcTransports || new Map();
        const transport = rtcTransports.get(transportId);
        if (!transport) {
          return respond({ success: false, error: 'Transport nicht gefunden' });
        }

        if (transport.appData?.participantId && transport.appData.participantId !== numericUserId) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Transport' });
        }

        if (transport.appData?.direction && transport.appData.direction !== 'recv') {
          return respond({ success: false, error: 'Transport ist nicht zum Empfangen vorgesehen' });
        }

        const roomName = rtcRoomNameForChannel(channelId);
        const rtcRooms: Set<string> = (socket.data as any).rtcRooms || new Set<string>();
        if (!rtcRooms.has(roomName)) {
          return respond({ success: false, error: 'Nicht im RTC-Raum' });
        }

        const router = await getOrCreateRtcRouter(channelId);
        if (!router.canConsume({ producerId, rtpCapabilities })) {
          return respond({ success: false, error: 'Inkompatible rtpCapabilities' });
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          appData: {
            ...(appData || {}),
            channelId,
            participantId: numericUserId,
            socketId: socket.id,
          },
        });

        rtcRoomManager.upsertConsumer(roomName, String(numericUserId), consumer.id, {
          producerId,
          transportId: transport.id,
          appData: consumer.appData as Record<string, any>,
        });

        const rtcConsumers: Map<string, MediasoupConsumer> = (socket.data as any).rtcConsumers || new Map();
        rtcConsumers.set(consumer.id, consumer);
        (socket.data as any).rtcConsumers = rtcConsumers;

        consumer.on('transportclose', () => {
          rtcRoomManager.removeConsumer(roomName, String(numericUserId), consumer.id);
          rtcConsumers.delete(consumer.id);
        });

        consumer.on('producerclose', () => {
          rtcRoomManager.removeConsumer(roomName, String(numericUserId), consumer.id);
          rtcConsumers.delete(consumer.id);
          try {
            consumer.close();
          } catch (err) {
            console.warn('Fehler beim Schließen eines Consumers nach Producer-Schließung:', err);
          }
        });

        respond({
          success: true,
          consumer: {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        });
      } catch (err: any) {
        console.error('Fehler bei rtc:consume:', err);
        respond({ success: false, error: err?.message || 'Konnte Consumer nicht erstellen' });
      }
    }
  );

  socket.on(
    'rtc:pauseConsumer',
    async (payload: { consumerId?: string }, ack?: (payload: { success: boolean; error?: string; consumerId?: string; paused?: boolean }) => void) => {
      const respond = (body: { success: boolean; error?: string; consumerId?: string; paused?: boolean }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { consumerId } = parsePayload(rtcPauseConsumerSchema, payload);

        const rtcConsumers: Map<string, MediasoupConsumer> = (socket.data as any).rtcConsumers || new Map();
        const consumer = rtcConsumers.get(consumerId);

        if (!consumer) {
          return respond({ success: false, error: 'Consumer nicht gefunden' });
        }

        if (consumer.appData?.participantId && consumer.appData.participantId !== numericUserId) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Consumer' });
        }

        await consumer.pause();
        respond({ success: true, consumerId: consumer.id, paused: consumer.paused });
      } catch (err: any) {
        console.error('Fehler bei rtc:pauseConsumer:', err);
        respond({ success: false, error: err?.message || 'Konnte Consumer nicht pausieren' });
      }
    }
  );

  socket.on(
    'rtc:resumeConsumer',
    async (payload: { consumerId?: string }, ack?: (payload: { success: boolean; error?: string; consumerId?: string; paused?: boolean }) => void) => {
      const respond = (body: { success: boolean; error?: string; consumerId?: string; paused?: boolean }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { consumerId } = parsePayload(rtcResumeConsumerSchema, payload);

        const rtcConsumers: Map<string, MediasoupConsumer> = (socket.data as any).rtcConsumers || new Map();
        const consumer = rtcConsumers.get(consumerId);

        if (!consumer) {
          return respond({ success: false, error: 'Consumer nicht gefunden' });
        }

        if (consumer.appData?.participantId && consumer.appData.participantId !== numericUserId) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Consumer' });
        }

        await consumer.resume();
        respond({ success: true, consumerId: consumer.id, paused: consumer.paused });
      } catch (err: any) {
        console.error('Fehler bei rtc:resumeConsumer:', err);
        respond({ success: false, error: err?.message || 'Konnte Consumer nicht fortsetzen' });
      }
    }
  );

  socket.on(
    'rtc:joinRoom',
    async (
      payload: { channelId?: number },
      ack?: (payload: { success: boolean; error?: string; roomName?: string; rtpCapabilities?: RtpCapabilities; peers?: any[] }) => void
    ) => {
      const respond = (body: { success: boolean; error?: string; roomName?: string; rtpCapabilities?: RtpCapabilities; peers?: any[] }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) {
          return respond({ success: false, error: 'unauthorized' });
        }

        const { channelId } = parsePayload(rtcJoinRoomSchema, payload);
        const channel = await ensureVoiceChannelAccess(channelId, numericUserId);
        const channelMemberships = getUserChannelIds(numericUserId);
        if (!channelMemberships.has(channelId)) {
          return respond({ success: false, error: 'Fehlende Berechtigung für diesen Kanal' });
        }

        const [router, user] = await Promise.all([getOrCreateRtcRouter(channelId), User.findByPk(numericUserId, { attributes: ['id', 'username', 'avatar_url'] })]);

        const roomName = rtcRoomNameForChannel(channelId);
        rtcRoomManager.registerParticipant(roomName, String(numericUserId), {
          userId: numericUserId,
          username: user?.username,
          avatarUrl: user?.avatar_url,
          serverId: channel.server_id,
          channelId,
        });

        const rtcRooms: Set<string> = (socket.data as any).rtcRooms || new Set<string>();
        rtcRooms.add(roomName);
        (socket.data as any).rtcRooms = rtcRooms;

        const peers = rtcRoomManager.listParticipants(roomName);

        respond({
          success: true,
          roomName,
          rtpCapabilities: router.rtpCapabilities,
          peers,
        });
      } catch (err: any) {
        console.error('Fehler bei rtc:joinRoom:', err);
        respond({ success: false, error: err?.message || 'Konnte RTC-Raum nicht öffnen' });
      }
    }
  );

  socket.on(
    'p2p:join',
    async (payload: { channelId?: number }, ack?: (payload: { success: boolean; error?: string; peers?: any[] }) => void) => {
      const respond = (body: { success: boolean; error?: string; peers?: any[] }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) return respond({ success: false, error: 'unauthorized' });

        const { channelId } = parsePayload(p2pJoinSchema, payload);
        await ensureVoiceChannelAccess(channelId, numericUserId);

        const joinedChannels: Set<number> = (socket.data as any).joinedChannels;
        if (!joinedChannels.has(channelId)) {
          socket.join(`channel_${channelId}`);
          joinedChannels.add(channelId);
        }

        const peers = await listActiveP2pPeers(channelId);

        const participants = p2pVoiceRooms.get(channelId) || new Set<number>();
        participants.add(numericUserId);
        p2pVoiceRooms.set(channelId, participants);

        const p2pChannels: Set<number> = (socket.data as any).p2pChannels || new Set<number>();
        p2pChannels.add(channelId);
        (socket.data as any).p2pChannels = p2pChannels;

        const self = await User.findByPk(numericUserId, { attributes: ['id', 'username', 'avatar_url'] });
        const peerSummary = self ? buildP2pPeerSummary(self) : { userId: numericUserId };

        socket.to(`channel_${channelId}`).emit('p2p:peer-joined', { channelId, peer: peerSummary });

        respond({ success: true, peers });
      } catch (err: any) {
        console.error('Fehler bei p2p:join:', err);
        respond({ success: false, error: err?.message || 'Konnte P2P-Raum nicht öffnen' });
      }
    }
  );

  socket.on(
    'p2p:offer',
    async (payload: { channelId?: number; targetUserId?: number; description?: Record<string, any> }, ack?: (payload: { success: boolean; error?: string }) => void) => {
      const respond = (body: { success: boolean; error?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) return respond({ success: false, error: 'unauthorized' });

        const { channelId, targetUserId, description } = parsePayload(p2pOfferAnswerSchema, payload);
        const participants = p2pVoiceRooms.get(channelId);
        if (!participants || !participants.has(numericUserId)) {
          return respond({ success: false, error: 'Nicht im P2P-Raum' });
        }

        if (!targetUserId || !participants.has(targetUserId)) {
          return respond({ success: false, error: 'Ziel nicht im Raum' });
        }

        const targets = getSocketsForUser(targetUserId);
        if (!targets.size) {
          return respond({ success: false, error: 'Ziel nicht verbunden' });
        }

        targets.forEach((target) => {
          target.emit('p2p:offer', { channelId, fromUserId: numericUserId, description });
        });

        respond({ success: true });
      } catch (err: any) {
        console.error('Fehler bei p2p:offer:', err);
        respond({ success: false, error: err?.message || 'Konnte Offer nicht senden' });
      }
    }
  );

  socket.on(
    'p2p:answer',
    async (payload: { channelId?: number; targetUserId?: number; description?: Record<string, any> }, ack?: (payload: { success: boolean; error?: string }) => void) => {
      const respond = (body: { success: boolean; error?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) return respond({ success: false, error: 'unauthorized' });

        const { channelId, targetUserId, description } = parsePayload(p2pOfferAnswerSchema, payload);
        const participants = p2pVoiceRooms.get(channelId);
        if (!participants || !participants.has(numericUserId)) {
          return respond({ success: false, error: 'Nicht im P2P-Raum' });
        }

        if (!targetUserId || !participants.has(targetUserId)) {
          return respond({ success: false, error: 'Ziel nicht im Raum' });
        }

        const targets = getSocketsForUser(targetUserId);
        if (!targets.size) {
          return respond({ success: false, error: 'Ziel nicht verbunden' });
        }

        targets.forEach((target) => {
          target.emit('p2p:answer', { channelId, fromUserId: numericUserId, description });
        });

        respond({ success: true });
      } catch (err: any) {
        console.error('Fehler bei p2p:answer:', err);
        respond({ success: false, error: err?.message || 'Konnte Answer nicht senden' });
      }
    }
  );

  socket.on(
    'p2p:candidate',
    async (payload: { channelId?: number; targetUserId?: number; candidate?: Record<string, any> }, ack?: (payload: { success: boolean; error?: string }) => void) => {
      const respond = (body: { success: boolean; error?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) return respond({ success: false, error: 'unauthorized' });

        const { channelId, targetUserId, candidate } = parsePayload(p2pCandidateSchema, payload);
        const participants = p2pVoiceRooms.get(channelId);
        if (!participants || !participants.has(numericUserId)) {
          return respond({ success: false, error: 'Nicht im P2P-Raum' });
        }

        if (!targetUserId || !participants.has(targetUserId)) {
          return respond({ success: false, error: 'Ziel nicht im Raum' });
        }

        const targets = getSocketsForUser(targetUserId);
        if (!targets.size) {
          return respond({ success: false, error: 'Ziel nicht verbunden' });
        }

        targets.forEach((target) => {
          target.emit('p2p:candidate', { channelId, fromUserId: numericUserId, candidate });
        });

        respond({ success: true });
      } catch (err: any) {
        console.error('Fehler bei p2p:candidate:', err);
        respond({ success: false, error: err?.message || 'Konnte Candidate nicht senden' });
      }
    }
  );

  socket.on(
    'p2p:signal',
    async (
      payload: { channelId?: number; targetUserId?: number; description?: Record<string, any>; candidate?: Record<string, any> },
      ack?: (payload: { success: boolean; error?: string }) => void
    ) => {
      const respond = (body: { success: boolean; error?: string }) => {
        if (typeof ack === 'function') ack(body);
      };

      try {
        consumeTokenOrThrow(socket);
        if (!numericUserId) return respond({ success: false, error: 'unauthorized' });

        const { channelId, targetUserId, description, candidate } = parsePayload(p2pSignalSchema, payload);
        if (!channelId) return respond({ success: false, error: 'Kanal fehlt' });

        const participants = p2pVoiceRooms.get(channelId);
        if (!participants || !participants.has(numericUserId)) {
          return respond({ success: false, error: 'Nicht im P2P-Raum' });
        }

        if (!targetUserId || !participants.has(targetUserId)) {
          return respond({ success: false, error: 'Ziel nicht im Raum' });
        }

        const targets = getSocketsForUser(targetUserId);
        if (!targets.size) {
          return respond({ success: false, error: 'Ziel nicht verbunden' });
        }

        targets.forEach((target) => {
          target.emit('p2p:signal', {
            channelId,
            fromUserId: numericUserId,
            description,
            candidate,
          });
        });

        respond({ success: true });
      } catch (err: any) {
        console.error('Fehler bei p2p:signal:', err);
        respond({ success: false, error: err?.message || 'Konnte Signal nicht senden' });
      }
    }
  );

  socket.on('join_channel', async (channelId: number) => {
    if (!numericUserId) return;

    try {
      consumeTokenOrThrow(socket);
      const validChannelId = parsePayload(channelIdSchema, channelId);

      const joinedChannels: Set<number> = (socket.data as any).joinedChannels;
      const globalChannels = userChannelMemberships.get(numericUserId) || new Set<number>();
      for (const prevChannel of Array.from(joinedChannels)) {
        if (prevChannel !== validChannelId) {
          socket.leave(`channel_${prevChannel}`);
          const rtcRooms: Set<string> = (socket.data as any).rtcRooms || new Set<string>();
          const prevRoomName = rtcRoomNameForChannel(prevChannel);
          if (rtcRooms.has(prevRoomName)) {
            rtcRoomManager.removeParticipant(prevRoomName, String(numericUserId));
            rtcRooms.delete(prevRoomName);
          }
          removeUserFromChannel(prevChannel, numericUserId);
          removeFromP2pRoom(prevChannel, numericUserId, socket);
          joinedChannels.delete(prevChannel);
          globalChannels.delete(prevChannel);
        }
      }

      const room = `channel_${validChannelId}`;
      socket.join(room);
      joinedChannels.add(validChannelId);
      globalChannels.add(validChannelId);
      userChannelMemberships.set(numericUserId, globalChannels);

      console.log(`Socket ${socket.id} joined channel_${validChannelId}`);
    } catch (err: any) {
      socket.emit('join_channel_error', { error: err?.message || 'Konnte Kanal nicht beitreten' });
    }
  });

  socket.on('request_server_members', async (payload: { serverId?: number }) => {
    try {
      consumeTokenOrThrow(socket);
      const { serverId } = parsePayload(requestServerMembersSchema, payload);

      const members = await ServerMember.findAll({
        where: { server_id: serverId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar_url', 'status']
        }]
      });

      const assignments = await MemberRole.findAll({
        where: { server_id: serverId },
        include: [{ model: Role, as: 'role' }]
      });

      const rolesByUser: Record<number, any[]> = {};
      assignments.forEach((a: any) => {
        rolesByUser[a.user_id] = rolesByUser[a.user_id] || [];
        if (a.role) rolesByUser[a.user_id].push(a.role);
      });

      const memberPayload = members.map((m: any) => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatar_url,
        status: m.user.status,
        joinedAt: m.createdAt,
        roles: rolesByUser[m.user.id] || [],
      }));

      socket.emit('server_members_snapshot', { serverId, members: memberPayload });
    } catch (err: any) {
      console.error('Fehler beim Senden der Member Snapshot:', err);
      socket.emit('server_members_error', { error: err?.message || 'Konnte Member nicht laden' });
    }
  });

  socket.on('leave_channel', (channelId: number) => {
    if (!numericUserId) return;

    try {
      consumeTokenOrThrow(socket);
      const validChannelId = parsePayload(channelIdSchema, channelId);

      const joinedChannels: Set<number> = (socket.data as any).joinedChannels;
      if (!joinedChannels.has(validChannelId)) return;

      socket.leave(`channel_${validChannelId}`);
      joinedChannels.delete(validChannelId);
      removeUserFromChannel(validChannelId, numericUserId);
      removeFromP2pRoom(validChannelId, numericUserId, socket);

      cleanupRtcResources(socket, { participantId: numericUserId, channelId: validChannelId });
    } catch (err: any) {
      socket.emit('leave_channel_error', { error: err?.message || 'Konnte Kanal nicht verlassen' });
    }
  });

  socket.on('disconnect', async () => {
    if (numericUserId) {
       console.log(`User ${numericUserId} disconnected`);

       const joinedChannels: Set<number> = (socket.data as any).joinedChannels || new Set();
       for (const ch of Array.from(joinedChannels)) {
         socket.leave(`channel_${ch}`);
         removeUserFromChannel(ch, numericUserId);
         removeFromP2pRoom(ch, numericUserId, socket);
         joinedChannels.delete(ch);
       }

       cleanupRtcResources(socket, { participantId: numericUserId });

       if ((socket.data as any).heartbeatInterval) {
         clearInterval((socket.data as any).heartbeatInterval);
       }

       if ((socket.data as any).presenceSnapshotInterval) {
         clearInterval((socket.data as any).presenceSnapshotInterval);
       }

       unregisterUserSocket(numericUserId, socket);
       scheduleOfflineCheck(numericUserId);
    }
  });
});

// ==========================================
// 5. SERVER STARTEN
// ==========================================
console.log('------------------------------------------------');
console.log('ℹ️ Starte Server ohne automatisches sequelize.sync(). Bitte führe Migrations aus.');
console.log('------------------------------------------------');

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Server] Läuft auf:`);
  console.log(`   - Local:   ${serverProtocol}://localhost:${PORT}`);
  console.log(`   - Network: ${serverProtocol}://127.0.0.1:${PORT}`);
  console.log(`   - Socket:  ${websocketProtocol}://localhost:${PORT}`);
  if (!tlsCredentials) {
    console.warn('⚠️ TLS assets not provided. HTTP/WebSocket insecure endpoints are active. Configure TLS_CERT_PATH and TLS_KEY_PATH for HTTPS/WSS.');
  }
  console.log("------------------------------------------------");
});
