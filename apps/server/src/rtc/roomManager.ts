import { Consumer, Peer, Producer, Room, Transport, type RtcMetadata, type RtcMediaKind, type RtcTransportDirection } from './entities';

export type ParticipantTrack = {
  sid: string;
  muted?: boolean;
  kind?: RtcMediaKind;
  transportId?: string;
  appData?: Record<string, any>;
};

export class RoomManager {
  private initialized = false;
  private readonly rooms = new Map<string, Room>();
  private readonly roomSweepIntervalMs = 30_000;
  private roomSweepTimer?: NodeJS.Timeout;
  private onRoomEmpty?: (roomName: string) => void;

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[RTC] RoomManager initialisiert (stateful mediasoup helper)');
    this.startRoomSweep();
  }

  private touchRoom(roomName: string) {
    this.ensureInitialized();
    const existing = this.rooms.get(roomName);
    if (existing) return existing;

    const room = new Room(roomName);
    this.rooms.set(roomName, room);
    return room;
  }

  private cleanupRoomIfEmpty(roomName: string) {
    const room = this.rooms.get(roomName);
    if (!room || !room.isEmpty()) return;

    this.rooms.delete(roomName);
    if (typeof this.onRoomEmpty === 'function') {
      this.onRoomEmpty(roomName);
    }
  }

  private startRoomSweep() {
    if (this.roomSweepTimer) return;

    this.roomSweepTimer = setInterval(() => {
      this.rooms.forEach((room, roomName) => {
        if (room.isEmpty()) {
          this.cleanupRoomIfEmpty(roomName);
        }
      });
    }, this.roomSweepIntervalMs);
  }

  getRoom(roomName: string) {
    return this.rooms.get(roomName);
  }

  setRoomEmptyHandler(handler: (roomName: string) => void) {
    this.onRoomEmpty = handler;
  }

  registerPeer(roomName: string, peerId: string, metadata?: RtcMetadata) {
    const room = this.touchRoom(roomName);
    return room.getOrCreatePeer(peerId, metadata);
  }

  updatePeerMetadata(roomName: string, peerId: string, metadata?: RtcMetadata) {
    const room = this.touchRoom(roomName);
    return room.getOrCreatePeer(peerId, metadata);
  }

  removePeer(roomName: string, peerId: string) {
    const room = this.rooms.get(roomName);
    if (!room) return false;
    const removed = room.removePeer(peerId);
    this.cleanupRoomIfEmpty(roomName);
    return removed;
  }

  createTransport(roomName: string, peerId: string, direction: RtcTransportDirection, appData?: Record<string, any>, id?: string) {
    const peer = this.registerPeer(roomName, peerId);
    const transport = new Transport(direction, appData, id);
    return peer.addTransport(transport);
  }

  markTransportConnected(roomName: string, peerId: string, transportId: string) {
    const room = this.rooms.get(roomName);
    const peer = room?.getPeer(peerId);
    const transport = peer?.markTransportConnected(transportId);
    return transport ?? null;
  }

  closeTransport(roomName: string, transportId: string) {
    const room = this.rooms.get(roomName);
    if (!room) return false;

    let removed = false;
    room.peers.forEach((peer) => {
      if (peer.removeTransport(transportId)) removed = true;
    });

    this.cleanupRoomIfEmpty(roomName);
    return removed;
  }

  upsertTrack(roomName: string, peerId: string, track: ParticipantTrack) {
    const peer = this.registerPeer(roomName, peerId);
    const producer = peer.upsertProducer(track.sid, {
      transportId: track.transportId,
      kind: track.kind,
      muted: track.muted,
      appData: track.appData,
    });
    return producer;
  }

  upsertProducer(roomName: string, peerId: string, producerId: string, input: { transportId?: string; kind?: RtcMediaKind; muted?: boolean; appData?: Record<string, any> }) {
    const peer = this.registerPeer(roomName, peerId);
    return peer.upsertProducer(producerId, input);
  }

  upsertConsumer(roomName: string, peerId: string, consumerId: string, input: { producerId?: string; transportId?: string; appData?: Record<string, any> }) {
    const peer = this.registerPeer(roomName, peerId);
    return peer.upsertConsumer(consumerId, input);
  }

  removeProducer(roomName: string, peerId: string, producerId: string) {
    const room = this.rooms.get(roomName);
    const peer = room?.getPeer(peerId);
    return peer?.removeProducer(producerId) ?? false;
  }

  removeConsumer(roomName: string, peerId: string, consumerId: string) {
    const room = this.rooms.get(roomName);
    const peer = room?.getPeer(peerId);
    return peer?.removeConsumer(consumerId) ?? false;
  }

  listParticipants(roomName: string) {
    const room = this.rooms.get(roomName);
    if (!room) return [] as { identity: string; tracks: ParticipantTrack[]; metadata?: RtcMetadata; lastSeen: number }[];
    return room.listParticipants();
  }

  mutePeer(roomName: string, peerId: string) {
    const room = this.rooms.get(roomName);
    if (!room) throw new Error('Teilnehmer nicht im Talk');
    const muted = room.mutePeer(peerId);
    if (!muted.length) throw new Error('Teilnehmer nicht im Talk');
    return muted;
  }

  registerParticipant(roomName: string, participantId: string, metadata?: RtcMetadata) {
    return this.registerPeer(roomName, participantId, metadata);
  }

  muteParticipant(roomName: string, participantId: string) {
    return this.mutePeer(roomName, participantId);
  }

  removeParticipant(roomName: string, participantId: string) {
    return this.removePeer(roomName, participantId);
  }
}

const singleton = new RoomManager();

export const getRoomManager = () => singleton;
export const rtcRoomManager = singleton;
