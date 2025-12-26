import type { Socket } from 'socket.io';
import type { Consumer as MediasoupConsumer, Producer as MediasoupProducer, WebRtcTransport } from 'mediasoup/node/lib/types';
import { rtcRoomManager } from '../rtc';
import { getSocketsForUser } from './registry';

export const rtcRoomNameForChannel = (channelId: number) => `channel_${channelId}`;

export const parseChannelIdFromRoomName = (roomName: string) => {
  const match = /^channel_(\d+)$/.exec(roomName);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const parseChannelId = (candidate?: any) => {
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
};

export const cleanupRtcResources = (socket: Socket, options?: { participantId?: number | null; channelId?: number }) => {
  const rtcConsumers: Map<string, MediasoupConsumer> = (socket.data as any).rtcConsumers || new Map();
  const rtcTransports: Map<string, WebRtcTransport> = (socket.data as any).rtcTransports || new Map();
  const rtcRooms: Set<string> = (socket.data as any).rtcRooms || new Set<string>();
  const rtcProducers: Map<string, MediasoupProducer> = (socket.data as any).rtcProducers || new Map();

  const participantIdentity = options?.participantId ? String(options.participantId) : null;
  const hasChannelFilter = typeof options?.channelId === 'number' && Number.isFinite(options.channelId);
  const roomNamesToCleanup = hasChannelFilter ? [rtcRoomNameForChannel(Number(options?.channelId))] : Array.from(rtcRooms);
  const matchesChannel = (candidate?: any) => (!hasChannelFilter ? true : Number(candidate) === Number(options?.channelId));

  rtcConsumers.forEach((consumer, id) => {
    if (!matchesChannel((consumer.appData as any)?.channelId)) return;
    const consumerRoomName = Number.isFinite((consumer.appData as any)?.channelId)
      ? rtcRoomNameForChannel(Number((consumer.appData as any)?.channelId))
      : undefined;
    if (participantIdentity && consumerRoomName) {
      rtcRoomManager.removeConsumer(consumerRoomName, participantIdentity, id);
    }
    try {
      consumer.close();
    } catch (err) {
      console.warn('Fehler beim Schließen eines RTC-Consumers:', err);
    }
    rtcConsumers.delete(id);
  });

  rtcProducers.forEach((producer, id) => {
    if (!matchesChannel((producer.appData as any)?.channelId)) return;
    const channelId = parseChannelId((producer.appData as any)?.channelId);
    const roomName = channelId ? rtcRoomNameForChannel(channelId) : null;

    if (participantIdentity && roomName) {
      rtcRoomManager.removeProducer(roomName, participantIdentity, id);
    }

    try {
      producer.close();
    } catch (err) {
      console.warn('Fehler beim Schließen eines RTC-Producers:', err);
    }

    rtcProducers.delete(id);
  });

  rtcTransports.forEach((transport, id) => {
    if (!matchesChannel((transport.appData as any)?.channelId)) return;
    const channelId = Number((transport.appData as any)?.channelId);
    if (Number.isFinite(channelId)) {
      const roomName = rtcRoomNameForChannel(channelId);
      rtcRoomManager.closeTransport(roomName, id);
    }
    try {
      transport.close();
    } catch (err) {
      console.warn('Fehler beim Schließen eines RTC-Transports:', err);
    }
    rtcTransports.delete(id);
  });

  roomNamesToCleanup.forEach((roomName) => {
    if (participantIdentity) {
      rtcRoomManager.removeParticipant(roomName, participantIdentity);
    }
    rtcRooms.delete(roomName);
  });

  (socket.data as any).rtcConsumers = rtcConsumers;
  (socket.data as any).rtcTransports = rtcTransports;
  (socket.data as any).rtcRooms = rtcRooms;
  (socket.data as any).rtcProducers = rtcProducers;
};

export const pauseRtcProducers = async (userId: number, channelId?: number | null) => {
  const sockets = Array.from(getSocketsForUser(userId));
  const paused: string[] = [];
  const channelFilter = typeof channelId === 'number' && Number.isFinite(channelId) ? channelId : null;

  await Promise.all(
    sockets.map(async (socket) => {
      const rtcProducers: Map<string, MediasoupProducer> = (socket.data as any).rtcProducers || new Map();

      await Promise.all(
        Array.from(rtcProducers.values()).map(async (producer) => {
          const producerChannelId = parseChannelId((producer.appData as any)?.channelId);
          if (channelFilter !== null && producerChannelId !== channelFilter) return;

          try {
            await Promise.resolve((producer as any).pause?.());
          } catch (err) {
            console.warn('Fehler beim Pausieren eines RTC-Producers:', err);
          }

          paused.push(producer.id);

          if (producerChannelId !== null) {
            rtcRoomManager.upsertProducer(rtcRoomNameForChannel(producerChannelId), String(userId), producer.id, { muted: true });
          }
        })
      );
    })
  );

  return Array.from(new Set(paused));
};

export const disconnectUserRtc = (userId: number, options?: { channelId?: number }) => {
  const sockets = Array.from(getSocketsForUser(userId));
  sockets.forEach((socket) => cleanupRtcResources(socket, { participantId: userId, channelId: options?.channelId }));
};
