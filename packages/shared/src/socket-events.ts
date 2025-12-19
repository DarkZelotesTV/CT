export const socketEvents = {
  presencePing: 'presence_ping',
  presenceAck: 'presence_ack',
  presenceSnapshot: 'presence_snapshot',
  userStatusChange: 'user_status_change',
  joinChannel: 'join_channel',
  requestServerMembers: 'request_server_members',
};

export type SocketEventKey = keyof typeof socketEvents;
