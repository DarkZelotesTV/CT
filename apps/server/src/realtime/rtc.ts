import { Consumer, Peer, Producer, Room, RoomManager, Transport, WorkerPool, getRoomManager, getWorkerPool, rtcRoomManager, rtcWorkerPool } from '../rtc';

export { Consumer, Peer, Producer, Room, RoomManager, Transport, WorkerPool, getRoomManager, getWorkerPool, rtcRoomManager, rtcWorkerPool } from '../rtc';

// Legacy alias for existing imports
export const getRtcModule = getRoomManager;
