import { useEffect, useMemo, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useVoice } from '../../context/voice-state';
import { Monitor, User, MicOff } from 'lucide-react';

type LayoutMode = 'grid' | 'speaker';

export const VoiceMediaStage = ({ layout }: { layout: LayoutMode }) => {
  const { activeRoom, connectionState } = useVoice();
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRoom) return;

    const bump = () => setRefreshToken((v) => v + 1);
    const handleSpeakers = (speakers: any[]) => setActiveSpeakerSid(speakers?.[0]?.sid ?? null);

    const events = [
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted
    ];

    events.forEach(e => activeRoom.on(e, bump));
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    handleSpeakers(activeRoom.activeSpeakers || []);

    return () => {
      events.forEach(e => activeRoom.off(e, bump));
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    };
  }, [activeRoom]);

  const participants = useMemo(() => {
    if (!activeRoom) return [];
    const remoteMap: Map<string, any> = (activeRoom as any).participants ?? (activeRoom as any).remoteParticipants ?? new Map();
    const list = [...((activeRoom as any).localParticipant ? [(activeRoom as any).localParticipant] : []), ...Array.from(remoteMap.values())];
    return list;
  }, [activeRoom, refreshToken]);

  const screenParticipants = useMemo(() => participants.filter((p: any) => p.isScreenShareEnabled), [participants]);

  const focusParticipant = useMemo(() => {
    if (screenParticipants.length) return screenParticipants[0];
    if (activeSpeakerSid) {
      const active = participants.find((p: any) => (p.sid || p.identity) === activeSpeakerSid);
      if (active) return active;
    }
    return participants[0] || null;
  }, [activeSpeakerSid, participants, screenParticipants]);

  if (!activeRoom || connectionState !== 'connected') return null;

  const renderTile = (participant: any, isScreenShare = false) => {
    const isSpeaking = activeSpeakerSid === (participant.sid || participant.identity) && !participant.isLocal;
    const hasVideo = isScreenShare ? participant.isScreenShareEnabled : participant.isCameraEnabled;
    const borderColor = isSpeaking ? 'border-green-500 ring-1 ring-green-500' : 'border-[#202225] hover:border-[#303236]';
    
    return (
      <div key={`${participant.sid}-${isScreenShare ? 'scr' : 'cam'}`} className={`relative rounded-xl overflow-hidden bg-[#2b2d31] transition-all border-2 ${borderColor} w-full h-full group shadow-md`}>
        {hasVideo ? (
           <ParticipantTile
              trackRef={{ participant, source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera }}
              className="w-full h-full object-cover bg-black"
              style={{ width: '100%', height: '100%' }}
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#2b2d31]">
                 <div className={`rounded-full p-4 lg:p-6 bg-[#5865f2] ${isSpeaking ? 'animate-pulse ring-4 ring-green-500/30' : ''}`}>
                    <User size={40} className="text-white" />
                 </div>
            </div>
        )}
        
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-white max-w-[85%] z-10 pointer-events-none">
            {isScreenShare ? <Monitor size={12} className="text-gray-300" /> : (!participant.isMicrophoneEnabled && <MicOff size={12} className="text-red-400"/>)}
            <span className="text-xs font-bold truncate tracking-wide text-gray-100 shadow-sm">
                {participant.name || participant.identity || (participant.isLocal ? 'Du' : 'Benutzer')}
            </span>
        </div>
      </div>
    );
  };

  if (layout === 'speaker' && focusParticipant) {
    return (
        <div className="flex flex-col lg:flex-row h-full p-4 gap-3">
            <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl bg-[#000000] border border-white/5 relative">
                 {renderTile(focusParticipant, focusParticipant.isScreenShareEnabled)}
            </div>
            <div className="h-32 lg:h-auto lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:pr-1 custom-scrollbar">
                {participants.filter(p => p !== focusParticipant).map(p => (
                    <div key={p.sid} className="w-48 lg:w-full h-full lg:h-36 flex-none">
                        {renderTile(p)}
                    </div>
                ))}
            </div>
        </div>
    )
  }

  // Auto Grid Calculation
  const gridCols = participants.length === 1 ? 'grid-cols-1 max-w-4xl' 
                 : participants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl'
                 : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className={`grid gap-3 w-full ${gridCols} auto-rows-[minmax(200px,1fr)] md:auto-rows-fr aspect-video max-h-full`}>
            {participants.map((p: any) => renderTile(p, false))}
            {screenParticipants.map((p: any) => renderTile(p, true))}
        </div>
    </div>
  );
};