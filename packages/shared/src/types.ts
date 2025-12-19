export interface ServerSummary {
  id: number;
  name: string;
  description?: string;
}

export interface ChannelSummary {
  id: number;
  name: string;
  serverId: number;
}

export interface PresenceUpdate {
  userId: number;
  status: 'online' | 'offline';
}

export interface LivekitTokenPayload {
  token: string;
  url: string;
}
