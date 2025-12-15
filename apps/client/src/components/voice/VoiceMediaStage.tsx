import { useEffect, useMemo, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useVoice } from '../../context/voice-state';
import { Monitor, User, MicOff } from 'lucide-react';

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
    activeRoom.on(RoomEvent.TrackMuted, bump);
    activeRoom.on(RoomEvent.TrackUnmuted, bump);

    handleSpeakers(activeRoom.activeSpeakers || []);

    return () => {
      activeRoom.off(RoomEvent.ParticipantConnected, bump);
      activeRoom.off(RoomEvent.ParticipantDisconnected, bump);
      activeRoom.off(RoomEvent.TrackPublished, bump);
      activeRoom.off(RoomEvent.TrackUnpublished, bump);
      activeRoom.off(RoomEvent.LocalTrackPublished, bump);
      activeRoom.off(RoomEvent.LocalTrackUnpublished, bump);
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
      activeRoom.off(RoomEvent.TrackMuted, bump);
      activeRoom.off(RoomEvent.TrackUnmuted, bump);
    };
  }, [activeRoom]);

  const participants = useMemo(() => {
    if (!activeRoom) return [] as any[];
    const remoteMap: Map<string, any> = (activeRoom as any).participants ?? (activeRoom as any).remoteParticipants ?? new Map();
    const remotes = Array.from(remoteMap.values());
    const locals = (activeRoom as any).localParticipant ? [(activeRoom as any).localParticipant] : [];
    return [...locals, ...remotes];
  }, [activeRoom, refreshToken]);

  const screenParticipants = useMemo(() => participants.filter((p: any) => !!p?.isScreenShareEnabled), [participants]);

  const focusParticipant = useMemo(() => {
    if (screenParticipants.length) return screenParticipants[0];
    if (activeSpeakerSid) {
      const active = participants.find((p: any) => String(p.sid || p.identity) === String(activeSpeakerSid));
      if (active) return active;
    }
    return participants[0] || null;
  }, [activeSpeakerSid, participants, screenParticipants]);

  if (!activeRoom || connectionState !== 'connected') {
    return null; 
  }

  // Helper für individuelle Kacheln
  const renderTile = (participant: any, isScreenShare = false) => {
    const isSpeaking = activeSpeakerSid === (participant.sid || participant.identity) && !participant.isLocal;
    const isLocal = participant.isLocal;
    const hasVideo = isScreenShare ? participant.isScreenShareEnabled : participant.isCameraEnabled;
    const isMicMuted = participant.isMicrophoneEnabled === false;
    
    // Discord Style Border Color
    const borderColor = isSpeaking ? 'border-green-500 shadow-[0_0_0_2px_#22c55e]' : 'border-[#202225] hover:border-[#404249]';

    return (
      <div
        key={`${participant.sid}-${isScreenShare ? 'screen' : 'cam'}`}
        className={`relative rounded-xl overflow-hidden bg-[#2b2d31] transition-all duration-200 border-2 ${borderColor} group w-full h-full flex flex-col`}
      >
        {hasVideo ? (
           <ParticipantTile
              trackRef={{ participant, source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera }}
              className="w-full h-full object-cover bg-black"
              style={{ width: '100%', height: '100%' }}
            />
        ) : (
            // Avatar Placeholder (Discord Style)
            <div className="w-full h-full flex items-center justify-center bg-[#2b2d31]">
                 <div className={`rounded-full p-6 bg-[#5865f2] ${isSpeaking ? 'animate-pulse ring-4 ring-green-500/30' : ''}`}>
                    <User size={48} className="text-white" />
                 </div>
            </div>
        )}

        {/* Name Tag Overlay (Discord Style: Bottom Left, Darker bg) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white max-w-[80%] pointer-events-none z-10">
            {isScreenShare ? <Monitor size={12} className="text-gray-300" /> : isMicMuted ? <MicOff size={12} className="text-red-400"/> : null}
            <span className="text-xs font-semibold truncate leading-tight shadow-sm">
                {participant.name || participant.identity || (isLocal ? 'Du' : 'Benutzer')}
            </span>
        </div>
        
        {/* Speaking Indicator (Green Circle in Corner if Video is on) */}
        {hasVideo && isSpeaking && (
            <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31] shadow-lg z-10" />
        )}
      </div>
    );
  };

  if (layout === 'speaker' && focusParticipant) {
    return (
        <div className="flex h-full p-4 gap-4">
            {/* Main Stage */}
            <div className="flex-1 rounded-xl overflow-hidden shadow-2xl bg-black relative">
                 {renderTile(focusParticipant, focusParticipant.isScreenShareEnabled)}
            </div>
            
            {/* Sidebar List */}
            <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                {participants.filter(p => p !== focusParticipant).map(p => (
                    <div key={p.sid} className="h-32 flex-none">
                        {renderTile(p)}
                    </div>
                ))}
            </div>
        </div>
    )
  }

  // Grid Layout (Standard)
  // Dynamische Grid-Größenberechnung
  const gridClass = participants.length <= 1 ? 'grid-cols-1 max-w-4xl mx-auto h-[80%]' 
                  : participants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto h-[60%]'
                  : participants.length <= 4 ? 'grid-cols-2 max-w-5xl mx-auto'
                  : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className={`grid gap-3 w-full ${gridClass} auto-rows-fr aspect-video max-h-full`}>
            {participants.map((participant: any) => renderTile(participant, false))}
            
            {/* Separate Tiles for Screen Shares */}
            {screenParticipants.map((participant: any) => renderTile(participant, true))}
        </div>
    </div>
  );
};