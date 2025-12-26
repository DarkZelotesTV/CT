import React, { useEffect, useMemo, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { useVoice } from '../index';
import { Monitor, MicOff } from 'lucide-react';

export const VoiceMediaStage = ({ layout }: { layout: 'grid' | 'speaker' }) => {
  const { providerId, connectionState, getNativeHandle } = useVoice();
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);
  const room = providerId === 'livekit' ? ((getNativeHandle?.() as any) as import('livekit-client').Room | null) : null;

  useEffect(() => {
    if (!room) return;
    const bump = () => setRefreshToken(v => v + 1);
    room.on(RoomEvent.ParticipantConnected, bump);
    room.on(RoomEvent.ParticipantDisconnected, bump);
    room.on(RoomEvent.ActiveSpeakersChanged, (s) => setActiveSpeakerSid(s[0]?.sid ?? null));
    return () => { room.off(RoomEvent.ParticipantConnected, bump); room.off(RoomEvent.ParticipantDisconnected, bump); };
  }, [room]);

  const participants = useMemo(() => {
    if (!room) return [];
    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
  }, [room, refreshToken]);

  const renderTile = (participant: LocalParticipant | RemoteParticipant) => {
    const isSpeaking = activeSpeakerSid === participant.sid && !participant.isLocal;
    const isScreenShare = participant.isScreenShareEnabled;
    const borderColor = isSpeaking ? 'border-accent shadow-neon' : 'border-border';

    return (
      <div key={participant.sid} className={`relative rounded-2xl overflow-hidden bg-surface-alt transition-all border-2 ${borderColor} w-full h-full shadow-glass`}>
        {/* FEHLERBEHEBUNG: Nutzung von trackRef statt direktem participant Prop */}
        <ParticipantTile 
            trackRef={{
                participant,
                source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera
            }}
            className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface/80 backdrop-blur-md text-text border border-border shadow-glass z-20 pointer-events-none">
            {isScreenShare ? <Monitor size={12} className="text-accent" /> : (!participant.isMicrophoneEnabled && <MicOff size={12} className="text-red-400"/>)}
            <span className="text-xs font-bold truncate">{participant.name || (participant.isLocal ? 'Du' : 'User')}</span>
        </div>
      </div>
    );
  };

  if (!room || providerId !== 'livekit' || connectionState !== 'connected') return null;

  return (
    <div className="flex-1 p-4 grid gap-4 h-full overflow-y-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {participants.map(p => renderTile(p))}
    </div>
  );
};
