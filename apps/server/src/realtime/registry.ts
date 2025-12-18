import type { Server as SocketIOServer, Socket } from 'socket.io';

export const channelPresence = new Map<number, Set<number>>();
export const channelPublicKeys = new Map<number, Map<number, string>>();
export const userChannelMemberships = new Map<number, Set<number>>();

const userSockets = new Map<number, Set<Socket>>();
let io: SocketIOServer | null = null;

export const setIoInstance = (instance: SocketIOServer) => {
  io = instance;
};

export const registerUserSocket = (userId: number, socket: Socket) => {
  const sockets = userSockets.get(userId) || new Set<Socket>();
  sockets.add(socket);
  userSockets.set(userId, sockets);
};

export const unregisterUserSocket = (userId: number, socket: Socket) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (!sockets.size) {
    userSockets.delete(userId);
  }
};

export const emitToUser = (userId: number, event: string, payload?: any) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.forEach((s) => s.emit(event, payload));
};

export const removeUserFromChannel = (channelId: number, userId: number) => {
  const presenceSet = channelPresence.get(channelId);
  const keys = channelPublicKeys.get(channelId);
  const memberships = userChannelMemberships.get(userId);

  let removed = false;

  if (presenceSet?.has(userId)) {
    presenceSet.delete(userId);
    removed = true;
    if (!presenceSet.size) channelPresence.delete(channelId);
  }

  if (keys?.has(userId)) {
    keys.delete(userId);
    if (!keys.size) channelPublicKeys.delete(channelId);
  }

  if (memberships?.has(channelId)) {
    memberships.delete(channelId);
    if (!memberships.size) userChannelMemberships.delete(userId);
  }

  if (removed && io) {
    io.to(`channel_${channelId}`).emit('channel_presence_leave', { channelId, userId });
  }

  return removed;
};

export const removeUserFromAllChannels = (userId: number) => {
  const channels = Array.from(userChannelMemberships.get(userId) || []);
  channels.forEach((channelId) => removeUserFromChannel(channelId, userId));
};

export const getUserChannelIds = (userId: number) => new Set(userChannelMemberships.get(userId) || []);
