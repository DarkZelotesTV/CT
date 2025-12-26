import {
  DisconnectReason,
  LocalTrackPublication,
  Participant,
  RemoteAudioTrack,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  type RoomOptions,
} from 'livekit-client';

export type LiveKitRoom = Room;
export type LiveKitParticipant = Participant;
export type LiveKitLocalTrackPublication = LocalTrackPublication;
export type LiveKitRemoteTrack = RemoteTrack;
export type LiveKitRemoteAudioTrack = RemoteAudioTrack;
export type LiveKitRoomOptions = RoomOptions;

export const createLiveKitRoom = (options?: LiveKitRoomOptions) => new Room(options);

export { DisconnectReason as LiveKitDisconnectReason, RoomEvent as LiveKitRoomEvent, Track as LiveKitTrack };
