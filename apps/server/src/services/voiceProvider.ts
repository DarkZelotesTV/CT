import { AccessToken, RoomServiceClient, type ParticipantInfo } from 'livekit-server-sdk';
import { getRtcModule } from '../realtime/rtc';

export type VoiceProviderId = 'livekit' | 'mediasoup';

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

const resolveVoiceProviderId = (): VoiceProviderId => {
  const rawProvider = (process.env.VOICE_PROVIDER || process.env.VOICE_PROVIDER_ID || process.env.VITE_VOICE_PROVIDER || '').toLowerCase();
  if (rawProvider === 'mediasoup') return 'mediasoup';
  return 'livekit';
};

class LiveKitVoiceProvider implements VoiceProvider {
  public readonly id: VoiceProviderId = 'livekit';
  private roomService: RoomServiceClient | null = null;
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly adminUrl = process.env.LIVEKIT_ADMIN_URL || process.env.LIVEKIT_PUBLIC_URL || process.env.VITE_LIVEKIT_URL;

  public readonly capabilities: VoiceProviderCapabilities = {
    tokens: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    participantControls: Boolean(
      process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && (process.env.LIVEKIT_ADMIN_URL || process.env.LIVEKIT_PUBLIC_URL || process.env.VITE_LIVEKIT_URL)
    ),
  };

  private ensureRoomService(): RoomServiceClient {
    if (this.roomService) return this.roomService;

    if (!this.apiKey || !this.apiSecret || !this.adminUrl) {
      throw new Error('LiveKit Konfiguration für Raumverwaltung fehlt');
    }

    const host = this.adminUrl.startsWith('ws') ? this.adminUrl.replace(/^ws/, 'http') : this.adminUrl;
    this.roomService = new RoomServiceClient(host, this.apiKey, this.apiSecret);
    return this.roomService;
  }

  async issueAccessToken({ roomName, userId, displayName, avatar }: { roomName: string; userId: string; displayName: string; avatar?: string | null }) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LiveKit API keys are missing');
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      metadata: JSON.stringify({
        avatar,
        displayName,
      }),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return at.toJwt();
  }

  async listParticipants(roomName: string): Promise<VoiceParticipant[]> {
    const participants = await this.ensureRoomService().listParticipants(roomName);
    return participants.map((participant: ParticipantInfo) => ({
      identity: participant.identity,
      tracks: (participant.tracks || []).map((track) => ({ sid: track.sid, muted: track.muted })),
    }));
  }

  async muteParticipant(roomName: string, participantIdentity: string): Promise<string[]> {
    const participants = await this.ensureRoomService().listParticipants(roomName);
    const target = participants.find((p) => p.identity === participantIdentity);

    if (!target) {
      throw new Error('Teilnehmer nicht im Talk');
    }

    const mutedTracks: string[] = [];
    await Promise.all(
      (target.tracks || []).map(async (track) => {
        mutedTracks.push(track.sid);
        return this.ensureRoomService().mutePublishedTrack(roomName, participantIdentity, track.sid, true);
      })
    );

    return mutedTracks;
  }

  async removeParticipant(roomName: string, participantIdentity: string) {
    await this.ensureRoomService().removeParticipant(roomName, participantIdentity);
  }
}

class MediasoupVoiceProvider implements VoiceProvider {
  public readonly id: VoiceProviderId = 'mediasoup';
  private readonly rtc = getRtcModule();
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
    return this.rtc.muteParticipant(roomName, participantIdentity);
  }

  async removeParticipant(roomName: string, participantIdentity: string) {
    this.rtc.removeParticipant(roomName, participantIdentity);
  }
}

let cachedProvider: VoiceProvider | null = null;

export const getVoiceProvider = (): VoiceProvider => {
  if (cachedProvider) return cachedProvider;

  const providerId = resolveVoiceProviderId();
  cachedProvider = providerId === 'mediasoup' ? new MediasoupVoiceProvider() : new LiveKitVoiceProvider();

  return cachedProvider;
};
