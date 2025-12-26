import crypto from 'crypto';

export type RtcTransportDirection = 'send' | 'recv';
export type RtcMediaKind = 'audio' | 'video' | 'screen' | 'data';
export type RtcMetadata = Record<string, any>;

export const createId = () => crypto.randomUUID?.() ?? crypto.randomBytes(16).toString('hex');

export class Transport {
  public readonly id: string;
  public readonly direction: RtcTransportDirection;
  public connected: boolean;
  public appData: Record<string, any>;
  public readonly createdAt: number;

  constructor(direction: RtcTransportDirection, appData?: Record<string, any>, id?: string) {
    this.id = id ?? createId();
    this.direction = direction;
    this.connected = false;
    this.appData = appData || {};
    this.createdAt = Date.now();
  }

  markConnected() {
    this.connected = true;
  }

  updateAppData(appData: Record<string, any>) {
    this.appData = { ...this.appData, ...appData };
  }
}

export class Producer {
  public readonly id: string;
  public transportId?: string;
  public readonly createdAt: number;
  public kind?: RtcMediaKind;
  public muted: boolean;
  public appData: Record<string, any>;

  constructor({ id, transportId, kind, muted, appData }: { id?: string; transportId?: string; kind?: RtcMediaKind; muted?: boolean; appData?: Record<string, any> }) {
    this.id = id ?? createId();
    this.transportId = transportId;
    this.kind = kind;
    this.muted = Boolean(muted);
    this.appData = appData || {};
    this.createdAt = Date.now();
  }

  update({ transportId, kind, muted, appData }: { transportId?: string; kind?: RtcMediaKind; muted?: boolean; appData?: Record<string, any> }) {
    if (typeof transportId !== 'undefined') this.transportId = transportId;
    if (typeof kind !== 'undefined') this.kind = kind;
    if (typeof muted !== 'undefined') this.muted = muted;
    if (appData) this.appData = { ...this.appData, ...appData };
  }

  mute() {
    this.muted = true;
  }

  toTrackSummary() {
    return { sid: this.id, muted: this.muted, kind: this.kind, transportId: this.transportId };
  }
}

export class Consumer {
  public readonly id: string;
  public readonly producerId?: string;
  public transportId?: string;
  public readonly createdAt: number;
  public appData: Record<string, any>;

  constructor({ id, producerId, transportId, appData }: { id?: string; producerId?: string; transportId?: string; appData?: Record<string, any> }) {
    this.id = id ?? createId();
    this.producerId = producerId;
    this.transportId = transportId;
    this.appData = appData || {};
    this.createdAt = Date.now();
  }

  update({ transportId, appData }: { transportId?: string; appData?: Record<string, any> }) {
    if (typeof transportId !== 'undefined') this.transportId = transportId;
    if (appData) this.appData = { ...this.appData, ...appData };
  }
}

export class Peer {
  public readonly id: string;
  public metadata?: RtcMetadata;
  public lastSeen: number;
  public readonly transports = new Map<string, Transport>();
  public readonly producers = new Map<string, Producer>();
  public readonly consumers = new Map<string, Consumer>();

  constructor(id: string, metadata?: RtcMetadata) {
    this.id = id;
    this.metadata = metadata;
    this.lastSeen = Date.now();
  }

  touch() {
    this.lastSeen = Date.now();
  }

  updateMetadata(partial?: RtcMetadata) {
    if (!partial) return;
    this.metadata = { ...(this.metadata || {}), ...partial };
    this.touch();
  }

  addTransport(transport: Transport) {
    this.transports.set(transport.id, transport);
    this.touch();
    return transport;
  }

  getTransport(transportId: string) {
    return this.transports.get(transportId);
  }

  markTransportConnected(transportId: string) {
    const transport = this.transports.get(transportId);
    if (!transport) return null;
    transport.markConnected();
    this.touch();
    return transport;
  }

  removeTransport(transportId: string) {
    const removed = this.transports.delete(transportId);
    if (removed) {
      this.producers.forEach((producer, id) => {
        if (producer.transportId === transportId) this.producers.delete(id);
      });
      this.consumers.forEach((consumer, id) => {
        if (consumer.transportId === transportId) this.consumers.delete(id);
      });
      this.touch();
    }
    return removed;
  }

  upsertProducer(producerId: string, input: { transportId?: string; kind?: RtcMediaKind; muted?: boolean; appData?: Record<string, any> }) {
    const existing = this.producers.get(producerId);
    if (existing) {
      existing.update(input);
      this.touch();
      return existing;
    }

    const producer = new Producer({ id: producerId, ...input });
    this.producers.set(producer.id, producer);
    this.touch();
    return producer;
  }

  upsertConsumer(consumerId: string, input: { producerId?: string; transportId?: string; appData?: Record<string, any> }) {
    const existing = this.consumers.get(consumerId);
    if (existing) {
      existing.update({ transportId: input.transportId, appData: input.appData });
      this.touch();
      return existing;
    }

    const consumer = new Consumer({ id: consumerId, producerId: input.producerId, transportId: input.transportId, appData: input.appData });
    this.consumers.set(consumer.id, consumer);
    this.touch();
    return consumer;
  }

  removeProducer(producerId: string) {
    const removed = this.producers.delete(producerId);
    if (removed) this.touch();
    return removed;
  }

  removeConsumer(consumerId: string) {
    const removed = this.consumers.delete(consumerId);
    if (removed) this.touch();
    return removed;
  }

  muteAllProducers() {
    const muted: string[] = [];
    this.producers.forEach((producer, sid) => {
      producer.mute();
      muted.push(sid);
    });
    if (muted.length) this.touch();
    return muted;
  }

  toParticipantSummary() {
    return {
      identity: this.id,
      tracks: Array.from(this.producers.values()).map((producer) => producer.toTrackSummary()),
      metadata: this.metadata,
      lastSeen: this.lastSeen,
    };
  }
}

export class Room {
  public readonly name: string;
  public readonly createdAt: number;
  public readonly peers = new Map<string, Peer>();

  constructor(name: string) {
    this.name = name;
    this.createdAt = Date.now();
  }

  getPeer(peerId: string) {
    return this.peers.get(peerId);
  }

  getOrCreatePeer(peerId: string, metadata?: RtcMetadata) {
    const existing = this.peers.get(peerId);
    if (existing) {
      existing.updateMetadata(metadata);
      existing.touch();
      return existing;
    }

    const peer = new Peer(peerId, metadata);
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId: string) {
    return this.peers.delete(peerId);
  }

  isEmpty() {
    return this.peers.size === 0;
  }

  listParticipants() {
    return Array.from(this.peers.values()).map((peer) => peer.toParticipantSummary());
  }

  mutePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return [] as string[];
    return peer.muteAllProducers();
  }
}
