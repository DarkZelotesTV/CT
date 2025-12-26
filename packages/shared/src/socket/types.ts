import type { Socket } from 'socket.io-client';

export type PresenceStatus = 'online' | 'offline';

export type ChannelPresenceUser = {
  id: number;
  username: string;
  avatar_url?: string;
  status?: PresenceStatus;
  isSpeaking?: boolean;
};

export type PresenceUserSnapshot = {
  id: number;
  username: string;
  avatar_url?: string;
  avatar?: string;
  avatarUrl?: string;
  status?: PresenceStatus;
};

export type ServerMemberPayload = {
  userId: number;
  username: string;
  avatarUrl?: string;
  status?: PresenceStatus;
  joinedAt?: string;
  roles: any[];
};

export type NotificationTarget = {
  serverId?: number;
  channelId?: number;
  channelName?: string;
  channelType?: 'text' | 'voice' | 'web' | 'data-transfer' | 'list' | 'spacer';
};

export type NotificationEventPayload = {
  title?: string;
  body: string;
  icon?: string;
  target?: NotificationTarget;
};

export type RtcNewProducerPayload = {
  roomName?: string;
  channelId?: number;
  peer?: any;
};

export type JoinRoomAck = {
  success: boolean;
  roomName?: string;
  rtpCapabilities?: any;
  peers?: any[];
  error?: string;
};

export type TransportAck = {
  success: boolean;
  transport?: any;
  error?: string;
};

export type ConnectAck = { success: boolean; error?: string };
export type ProduceAck = { success: boolean; producerId?: string; error?: string };
export type ConsumeAck = {
  success: boolean;
  consumer?: { id: string; producerId: string; kind: any; rtpParameters: any };
  error?: string;
};

export type PauseResumeAck = { success: boolean; error?: string; consumerId?: string; paused?: boolean };
export type TransportDefaultsAck = { success: boolean; error?: string; defaults?: any };

export type ServerToClientEvents = {
  presence_ping: () => void;
  presence_snapshot: (payload: { users: PresenceUserSnapshot[] }) => void;
  channel_presence_snapshot: (payload: { channelId: number; users: ChannelPresenceUser[] }) => void;
  channel_presence_join: (payload: { channelId: number; user: ChannelPresenceUser }) => void;
  channel_presence_leave: (payload: { channelId: number; userId: number }) => void;
  user_status_change: (payload: { userId: number; status: PresenceStatus }) => void;
  join_channel_error: (payload: { error: string }) => void;
  leave_channel_error: (payload: { error: string }) => void;
  server_members_snapshot: (payload: { serverId: number; members: ServerMemberPayload[] }) => void;
  server_members_error: (payload: { error: string }) => void;
  server_unread: (payload: Record<number, number> | { serverId: number; count: number }) => void;
  server_unread_counts: (payload: Record<number, number>) => void;
  mention: (payload: NotificationEventPayload) => void;
  direct_message: (payload: NotificationEventPayload) => void;
  server_invite: (payload: NotificationEventPayload) => void;
  'rtc:newProducer': (payload: RtcNewProducerPayload) => void;
};

export type ClientToServerEvents = {
  presence_ack: () => void;
  join_channel: (channelId: number) => void;
  leave_channel: (channelId: number) => void;
  request_server_members: (payload: { serverId?: number }) => void;
  'rtc:joinRoom': (payload: { channelId?: number }, ack: (res: JoinRoomAck) => void) => void;
  'rtc:createTransport': (
    payload: { channelId?: number; direction?: 'send' | 'recv' },
    ack: (res: TransportAck) => void
  ) => void;
  'rtc:connectTransport': (payload: { transportId?: string; dtlsParameters?: any }, ack: (res: ConnectAck) => void) => void;
  'rtc:produce': (
    payload: { channelId?: number; transportId?: string; rtpParameters?: any; appData?: Record<string, any> },
    ack: (res: ProduceAck) => void
  ) => void;
  'rtc:consume': (
    payload: { channelId?: number; transportId?: string; producerId?: string; rtpCapabilities?: any; appData?: Record<string, any> },
    ack: (res: ConsumeAck) => void
  ) => void;
  'rtc:pauseConsumer': (payload: { consumerId?: string }, ack: (res: PauseResumeAck) => void) => void;
  'rtc:resumeConsumer': (payload: { consumerId?: string }, ack: (res: PauseResumeAck) => void) => void;
  'rtc:transport-defaults': (ack: (res: TransportDefaultsAck) => void) => void;
};

export type AckEventMap = {
  'rtc:joinRoom': { payload: { channelId?: number }; response: JoinRoomAck };
  'rtc:createTransport': { payload: { channelId?: number; direction?: 'send' | 'recv' }; response: TransportAck };
  'rtc:connectTransport': { payload: { transportId?: string; dtlsParameters?: any }; response: ConnectAck };
  'rtc:produce': { payload: { channelId?: number; transportId?: string; rtpParameters?: any; appData?: Record<string, any> }; response: ProduceAck };
  'rtc:consume': {
    payload: { channelId?: number; transportId?: string; producerId?: string; rtpCapabilities?: any; appData?: Record<string, any> };
    response: ConsumeAck;
  };
  'rtc:pauseConsumer': { payload: { consumerId?: string }; response: PauseResumeAck };
  'rtc:resumeConsumer': { payload: { consumerId?: string }; response: PauseResumeAck };
  'rtc:transport-defaults': { payload?: undefined; response: TransportDefaultsAck };
};

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type AckEventKey = keyof AckEventMap;
export type AckPayload<K extends AckEventKey> = AckEventMap[K]['payload'];
export type AckResponse<K extends AckEventKey> = AckEventMap[K]['response'];
