import type { Socket } from 'socket.io';

export const userChannelMemberships = new Map<number, Set<number>>();

const userSockets = new Map<number, Set<Socket>>();

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

export const getSocketsForUser = (userId: number) => {
  const sockets = userSockets.get(userId);
  return sockets ? new Set(sockets) : new Set<Socket>();
};

export const removeUserFromChannel = (channelId: number, userId: number) => {
  const memberships = userChannelMemberships.get(userId);

  if (memberships?.has(channelId)) {
    memberships.delete(channelId);
    if (!memberships.size) userChannelMemberships.delete(userId);
    return true;
  }

  return false;
};

export const removeUserFromAllChannels = (userId: number) => {
  const channels = Array.from(userChannelMemberships.get(userId) || []);
  channels.forEach((channelId) => removeUserFromChannel(channelId, userId));
};

export const getUserChannelIds = (userId: number) => new Set(userChannelMemberships.get(userId) || []);
