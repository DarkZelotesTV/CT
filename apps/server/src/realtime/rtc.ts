import crypto from 'crypto';

export type RtcTransportDirection = 'send' | 'recv';

export type RtcParticipantTrack = {
  sid: string;
  muted?: boolean;
  kind?: 'audio' | 'video' | 'screen';
  transportId?: string;
};

export type RtcTransport = {
  id: string;
  direction: RtcTransportDirection;
  connected: boolean;
  appData?: Record<string, any>;
  createdAt: number;
};

export type RtcParticipant = {
  id: string;
  tracks: Map<string, RtcParticipantTrack>;
  transports: Map<string, RtcTransport>;
  metadata?: Record<string, any>;
  lastSeen: number;
};

export type RtcRoom = {
  name: string;
  participants: Map<string, RtcParticipant>;
  createdAt: number;
};

const createId = () => crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex');

class RtcModule {
  private initialized = false;
  private readonly rooms = new Map<string, RtcRoom>();

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[RTC] Mediasoup controller initialisiert (lightweight state tracker)');
  }

  private touchRoom(roomName: string): RtcRoom {
    this.ensureInitialized();
    const existing = this.rooms.get(roomName);
    if (existing) return existing;

    const room: RtcRoom = {
      name: roomName,
      participants: new Map(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomName, room);
    return room;
  }

  private touchParticipant(roomName: string, participantId: string, metadata?: Record<string, any>): RtcParticipant {
    const room = this.touchRoom(roomName);
    const now = Date.now();
    const existing = room.participants.get(participantId);
    if (existing) {
      existing.metadata = { ...(existing.metadata || {}), ...(metadata || {}) };
      existing.lastSeen = now;
      return existing;
    }

    const participant: RtcParticipant = {
      id: participantId,
      tracks: new Map(),
      transports: new Map(),
      metadata: metadata || {},
      lastSeen: now,
    };

    room.participants.set(participantId, participant);
    return participant;
  }

  private cleanupRoomIfEmpty(roomName: string) {
    const room = this.rooms.get(roomName);
    if (!room) return;
    if (room.participants.size === 0) {
      this.rooms.delete(roomName);
    }
  }

  registerParticipant(roomName: string, participantId: string, metadata?: Record<string, any>) {
    return this.touchParticipant(roomName, participantId, metadata);
  }

  upsertTrack(roomName: string, participantId: string, track: RtcParticipantTrack) {
    const participant = this.touchParticipant(roomName, participantId);
    const existing = participant.tracks.get(track.sid);
    participant.tracks.set(track.sid, { ...(existing || {}), ...track });
    participant.lastSeen = Date.now();
    return participant.tracks.get(track.sid)!;
  }

  createTransport(roomName: string, participantId: string, direction: RtcTransportDirection, appData?: Record<string, any>): RtcTransport {
    const participant = this.touchParticipant(roomName, participantId);
    const transport: RtcTransport = {
      id: createId(),
      direction,
      connected: false,
      appData: appData || {},
      createdAt: Date.now(),
    };
    participant.transports.set(transport.id, transport);
    participant.lastSeen = Date.now();
    return transport;
  }

  markTransportConnected(roomName: string, participantId: string, transportId: string) {
    const room = this.rooms.get(roomName);
    const participant = room?.participants.get(participantId);
    const transport = participant?.transports.get(transportId);
    if (!transport) return null;
    transport.connected = true;
    participant!.lastSeen = Date.now();
    return transport;
  }

  closeTransport(roomName: string, transportId: string) {
    const room = this.rooms.get(roomName);
    if (!room) return false;
    for (const participant of room.participants.values()) {
      if (participant.transports.has(transportId)) {
        participant.transports.delete(transportId);
        participant.lastSeen = Date.now();
        return true;
      }
    }
    return false;
  }

  listParticipants(roomName: string) {
    const room = this.rooms.get(roomName);
    if (!room) return [];

    return Array.from(room.participants.values()).map((participant) => ({
      identity: participant.id,
      tracks: Array.from(participant.tracks.values()).map((t) => ({ sid: t.sid, muted: t.muted })),
    }));
  }

  muteParticipant(roomName: string, participantId: string): string[] {
    const room = this.rooms.get(roomName);
    const participant = room?.participants.get(participantId);
    if (!participant) {
      throw new Error('Teilnehmer nicht im Talk');
    }

    const mutedTracks: string[] = [];
    participant.tracks.forEach((track, sid) => {
      participant.tracks.set(sid, { ...track, muted: true });
      mutedTracks.push(sid);
    });
    participant.lastSeen = Date.now();
    return mutedTracks;
  }

  removeParticipant(roomName: string, participantId: string) {
    const room = this.rooms.get(roomName);
    if (!room) {
      return;
    }

    room.participants.delete(participantId);
    this.cleanupRoomIfEmpty(roomName);
  }
}

const singleton = new RtcModule();

export const getRtcModule = () => singleton;
