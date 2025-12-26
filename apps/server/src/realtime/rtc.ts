import { Consumer, Peer, Producer, Room, RoomManager, Transport, getRoomManager, rtcRoomManager } from '../rtc';

export { Consumer, Peer, Producer, Room, RoomManager, Transport, getRoomManager, rtcRoomManager } from '../rtc';

// Legacy alias for existing imports
export const getRtcModule = getRoomManager;
