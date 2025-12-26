import { getRoomManager } from '../rtc';
import { disconnectUserRtc, parseChannelIdFromRoomName, pauseRtcProducers } from '../realtime/rtcModeration';

export type VoiceProviderId = 'mediasoup';

export type VoiceProviderCapabilities = {
  tokens: boolean;
  participantControls: boolean;
};

export type VoiceParticipant = {
  identity: string;
  tracks: { sid: string; muted?: boolean }[];
};

export interface VoiceProvider {
  id: VoiceProviderId;
  capabilities: VoiceProviderCapabilities;
  issueAccessToken(input: { roomName: string; userId: string; displayName: string; avatar?: string | null }): Promise<string>;
  listParticipants(roomName: string): Promise<VoiceParticipant[]>;
  muteParticipant(roomName: string, participantIdentity: string): Promise<string[]>;
  removeParticipant(roomName: string, participantIdentity: string): Promise<void>;
}

class MediasoupVoiceProvider implements VoiceProvider {
  public readonly id: VoiceProviderId = 'mediasoup';
  private readonly rtc = getRoomManager();
  public readonly capabilities: VoiceProviderCapabilities = {
    tokens: false,
    participantControls: true,
  };

  async issueAccessToken({ roomName, userId, displayName, avatar }: { roomName: string; userId: string; displayName: string; avatar?: string | null }) {
    // Mediasoup nutzt Signaling statt klassischer Tokens, wir halten aber stateful Metadaten für spätere Moderation bereit.
    this.rtc.registerParticipant(roomName, userId, { displayName, avatar });
    return `mediasoup:${roomName}:${userId}`;
  }

  async listParticipants(roomName: string) {
    return this.rtc.listParticipants(roomName);
  }

  async muteParticipant(roomName: string, participantIdentity: string) {
    const channelId = parseChannelIdFromRoomName(roomName);
    const numericParticipantId = Number(participantIdentity);
    const pausedTracks =
      Number.isFinite(numericParticipantId) && channelId !== null
        ? await pauseRtcProducers(numericParticipantId, channelId)
        : Number.isFinite(numericParticipantId)
          ? await pauseRtcProducers(numericParticipantId)
          : [];

    const rtcMutedTracks = this.rtc.muteParticipant(roomName, participantIdentity);
    return Array.from(new Set([...(pausedTracks || []), ...(rtcMutedTracks || [])]));
  }

  async removeParticipant(roomName: string, participantIdentity: string) {
    const channelId = parseChannelIdFromRoomName(roomName);
    const numericParticipantId = Number(participantIdentity);

    if (Number.isFinite(numericParticipantId)) {
      disconnectUserRtc(numericParticipantId, { channelId: channelId ?? undefined });
    }

    this.rtc.removeParticipant(roomName, participantIdentity);
  }
}

let cachedProvider: VoiceProvider | null = null;

export const getVoiceProvider = (): VoiceProvider => {
  if (cachedProvider) return cachedProvider;

  cachedProvider = new MediasoupVoiceProvider();

  return cachedProvider;
};
