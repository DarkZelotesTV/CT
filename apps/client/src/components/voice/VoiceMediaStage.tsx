import { useEffect, useMemo, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useVoice } from '../../context/voice-state';
import { Monitor, Video, Volume2 } from 'lucide-react';

type LayoutMode = 'grid' | 'speaker';

export const VoiceMediaStage = ({ layout }: { layout: LayoutMode }) => {
  const { activeRoom, connectionState, localParticipantId } = useVoice();
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRoom) return;

    const bump = () => setRefreshToken((value) => value + 1);
    const handleSpeakers = (speakers: any[]) => {
      const top = speakers?.[0];
      setActiveSpeakerSid(top?.sid ?? null);
    };

    activeRoom.on(RoomEvent.ParticipantConnected, bump);
    activeRoom.on(RoomEvent.ParticipantDisconnected, bump);
    activeRoom.on(RoomEvent.TrackPublished, bump);
    activeRoom.on(RoomEvent.TrackUnpublished, bump);
    activeRoom.on(RoomEvent.LocalTrackPublished, bump);
    activeRoom.on(RoomEvent.LocalTrackUnpublished, bump);
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, handleSpeakers);

    handleSpeakers(activeRoom.activeSpeakers || []);

    return () => {
      activeRoom.off(RoomEvent.ParticipantConnected, bump);
      activeRoom.off(RoomEvent.ParticipantDisconnected, bump);
      activeRoom.off(RoomEvent.TrackPublished, bump);
      activeRoom.off(RoomEvent.TrackUnpublished, bump);
      activeRoom.off(RoomEvent.LocalTrackPublished, bump);
      activeRoom.off(RoomEvent.LocalTrackUnpublished, bump);
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    };
  }, [activeRoom]);

  const participants = useMemo(() => {
    if (!activeRoom) return [] as any[];

    const remoteMap: Map<string, any> = (activeRoom as any).participants ?? (activeRoom as any).remoteParticipants ?? new Map();
    const remotes = Array.from(remoteMap.values());
    const locals = (activeRoom as any).localParticipant ? [(activeRoom as any).localParticipant] : [];
    return [...locals, ...remotes];
  }, [activeRoom, refreshToken]);

  const screenParticipants = useMemo(
    () => participants.filter((p: any) => !!p?.isScreenShareEnabled),
    [participants]
  );
  const videoParticipants = useMemo(() => participants.filter((p: any) => !!p?.isCameraEnabled), [participants]);

  const focusParticipant = useMemo(() => {
    if (screenParticipants.length) return screenParticipants[0];
    if (activeSpeakerSid) {
      const active = participants.find((p: any) => String(p.sid || p.identity) === String(activeSpeakerSid));
      if (active) return active;
    }
    return participants[0] || null;
  }, [activeSpeakerSid, participants, screenParticipants]);

  if (!activeRoom || connectionState !== 'connected') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Verbinde Voice...
      </div>
    );
  }

  if (!screenParticipants.length && !videoParticipants.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2 py-8">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Video />
        </div>
        <div className="font-semibold">Noch keine Video- oder Screen-Streams</div>
        <div className="text-xs text-gray-500">Starte deine Kamera oder den Screenshare, um loszulegen.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {screenParticipants.map((participant: any) => (
        <div
          key={`screen-${participant.sid || participant.identity}`}
          className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-black/40"
        >
          <ParticipantTile
            trackRef={{ participant, source: Track.Source.ScreenShare }}
            className="min-h-[240px] w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-xs text-white pointer-events-none">
            <Monitor size={14} />
            <span className="font-semibold truncate">
              Screenshare: {participant.name || participant.identity || 'Unbekannt'}
            </span>
          </div>
        </div>
      ))}

      {layout === 'speaker' && focusParticipant ? (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-8 relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 min-h-[260px]">
            <ParticipantTile
              trackRef={{
                participant: focusParticipant,
                source: focusParticipant.isScreenShareEnabled ? Track.Source.ScreenShare : Track.Source.Camera,
              }}
              className="h-full w-full"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-xs text-white pointer-events-none">
              <Volume2 size={14} className="text-green-400" />
              <span className="font-semibold truncate">
                {focusParticipant.name || focusParticipant.identity || (focusParticipant.isLocal ? 'Du' : 'Teilnehmer')}
              </span>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            {videoParticipants
              .filter((p) => p !== focusParticipant)
              .map((participant: any) => (
                <div
                  key={participant.sid || participant.identity}
                  className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 min-h-[160px]"
                >
                  <ParticipantTile 
                    trackRef={{ participant, source: Track.Source.Camera }}
                    className="w-full h-full absolute inset-0"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {videoParticipants.map((participant: any) => (
            <div
              key={participant.sid || participant.identity || participant.name}
              className={`relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 min-h-[200px] ${
                participant.sid === localParticipantId ? 'shadow-lg shadow-cyan-500/20' : ''
              }`}
            >
              <ParticipantTile 
                trackRef={{ participant, source: Track.Source.Camera }} 
                className="w-full h-full absolute inset-0"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};