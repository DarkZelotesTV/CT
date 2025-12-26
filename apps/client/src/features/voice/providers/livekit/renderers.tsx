import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoomAudioRenderer, RoomContext, ParticipantTile } from '@livekit/components-react';
import { Monitor, MicOff } from 'lucide-react';
import { type VoiceMediaStageProps, type VoiceProviderRenderers } from '../types';
import { useVoice } from '../../state/VoiceContext';
import {
  LiveKitRoomEvent,
  LiveKitTrack,
  type LiveKitParticipant,
  type LiveKitRoom,
} from './client';

const LiveKitProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { getNativeHandle } = useVoice();
  const room = getNativeHandle?.() as LiveKitRoom | null;

  if (!room) return <>{children}</>;
  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
};

const LiveKitAudioRenderer = () => {
  const { muted, getNativeHandle } = useVoice();
  const room = getNativeHandle?.() as LiveKitRoom | null;

  if (!room || muted) return null;
  return <RoomAudioRenderer />;
};

const LiveKitMediaStage = ({
  layout,
  activeSpeakerIds,
  connectionState,
  nativeHandle,
}: VoiceMediaStageProps) => {
  const room = nativeHandle as LiveKitRoom | null;
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    const bump = () => setRefreshToken((v) => v + 1);
    const handleSpeakers = (speakers: any[]) => setActiveSpeakerSid(speakers?.[0]?.sid ?? null);

    const events = [
      LiveKitRoomEvent.ParticipantConnected,
      LiveKitRoomEvent.ParticipantDisconnected,
      LiveKitRoomEvent.TrackPublished,
      LiveKitRoomEvent.TrackUnpublished,
      LiveKitRoomEvent.LocalTrackPublished,
      LiveKitRoomEvent.LocalTrackUnpublished,
      LiveKitRoomEvent.TrackMuted,
      LiveKitRoomEvent.TrackUnmuted,
      LiveKitRoomEvent.ConnectionStateChanged,
      LiveKitRoomEvent.TrackSubscribed,
      LiveKitRoomEvent.TrackUnsubscribed,
      LiveKitRoomEvent.ParticipantMetadataChanged,
    ];

    events.forEach((e) => room.on(e, bump));
    room.on(LiveKitRoomEvent.ActiveSpeakersChanged, handleSpeakers);
    handleSpeakers(room.activeSpeakers || []);

    return () => {
      events.forEach((e) => room.off(e, bump));
      room.off(LiveKitRoomEvent.ActiveSpeakersChanged, handleSpeakers);
    };
  }, [room]);

  const participants = useMemo(() => {
    if (!room) return [];
    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
  }, [room, refreshToken]);

  const participantsWithoutScreens = useMemo(
    () => participants.filter((p) => !p.isScreenShareEnabled),
    [participants]
  );
  const screenParticipants = useMemo(() => participants.filter((p) => p.isScreenShareEnabled), [participants]);

  const renderTile = (participant: LiveKitParticipant, isScreenShare = false) => {
    const activeSid = activeSpeakerIds[0] ?? activeSpeakerSid;
    const isSpeaking = activeSid === (participant.sid || participant.identity);

    let metadata: { avatar?: string; displayName?: string } = {};
    try {
      metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch (e) {
      console.warn('Failed to parse participant metadata', e);
    }

    const publication = isScreenShare
      ? participant.getTrackPublication(LiveKitTrack.Source.ScreenShare)
      : participant.getTrackPublication(LiveKitTrack.Source.Camera);

    const isTrackEnabled = !!publication && !publication.isMuted && (participant.isLocal || publication.isSubscribed);

    return (
      <div
        key={`${participant.sid}-${isScreenShare}`}
        className={`relative rounded-2xl overflow-hidden bg-[#0b0c10] border-2 transition-all duration-300 shadow-xl flex flex-col ${
          isSpeaking ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02]' : 'border-white/5'
        }`}
      >
        {isTrackEnabled ? (
          <ParticipantTile
            trackRef={{
              participant,
              source: isScreenShare ? LiveKitTrack.Source.ScreenShare : LiveKitTrack.Source.Camera,
              publication,
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1b1e] to-[#0b0c10] relative">
            {isScreenShare ? (
              <Monitor size={48} className="text-white/10 animate-pulse" />
            ) : (
              <div className="relative group">
                <div
                  className={`w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 transition-all duration-500 ${
                    isSpeaking ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]' : 'border-white/10 group-hover:border-white/20'
                  }`}
                >
                  {metadata.avatar ? (
                    <img src={metadata.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#313338] flex items-center justify-center text-white text-3xl font-bold">
                      {(metadata.displayName || participant.identity).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {isSpeaking && (
                  <div className="absolute -inset-4 border-2 border-indigo-500/30 rounded-full animate-ping pointer-events-none" />
                )}
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white pointer-events-none">
          {!participant.isMicrophoneEnabled && <MicOff size={14} className="text-red-400" />}
          <span className="text-xs font-bold tracking-wide">
            {metadata.displayName || participant.name || participant.identity}
          </span>
        </div>
      </div>
    );
  };

  if (!room || connectionState !== 'connected') return null;

  const gridCols =
    participantsWithoutScreens.length <= 1
      ? 'grid-cols-1 max-w-3xl'
      : participantsWithoutScreens.length <= 4
        ? 'grid-cols-2 max-w-6xl'
        : 'grid-cols-3';

  return (
    <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
      <div className={`grid gap-6 w-full ${gridCols} auto-rows-fr aspect-video`}>
        {participantsWithoutScreens.map((p) => renderTile(p, false))}
        {screenParticipants.map((p) => renderTile(p, true))}
      </div>
    </div>
  );
};

export const liveKitRenderers: VoiceProviderRenderers = {
  MediaStage: LiveKitMediaStage,
  AudioRenderer: LiveKitAudioRenderer,
  ProviderWrapper: LiveKitProviderWrapper,
};
