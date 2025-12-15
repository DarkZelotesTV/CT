import { useEffect, useMemo, useState } from 'react';
import { ParticipantTile, useTracks } from '@livekit/components-react';
import { RoomEvent, Track, LocalParticipant, RemoteParticipant, TrackPublication } from 'livekit-client';
import { useVoice } from '../../context/voice-state';
import { Monitor, User, MicOff, AlertCircle } from 'lucide-react';

type LayoutMode = 'grid' | 'speaker';

export const VoiceMediaStage = ({ layout }: { layout: LayoutMode }) => {
  const { activeRoom, connectionState } = useVoice();
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);

  // Re-Render Trigger bei Room-Events
  useEffect(() => {
    if (!activeRoom) return;
    const bump = () => setRefreshToken((v) => v + 1);
    const handleSpeakers = (speakers: any[]) => setActiveSpeakerSid(speakers?.[0]?.sid ?? null);

    const events = [
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.ConnectionStateChanged,
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed // Wichtig für Remote Streams
    ];

    events.forEach(e => activeRoom.on(e, bump));
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    handleSpeakers(activeRoom.activeSpeakers || []);

    return () => {
      events.forEach(e => activeRoom.off(e, bump));
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    };
  }, [activeRoom]);

  // Teilnehmer-Liste zusammenstellen
  const participants = useMemo(() => {
    if (!activeRoom) return [];
    const remoteMap = activeRoom.remoteParticipants;
    const remotes = Array.from(remoteMap.values());
    const local = activeRoom.localParticipant;
    return [local, ...remotes]; // Local User immer zuerst
  }, [activeRoom, refreshToken]);

  // Filter für Screen-Shares (inkl. Local User)
  const screenParticipants = useMemo(() => 
    participants.filter((p) => p.isScreenShareEnabled), 
  [participants]);

  // Fokus-Teilnehmer ermitteln (für Speaker View)
  const focusParticipant = useMemo(() => {
    if (screenParticipants.length) return screenParticipants[0];
    if (activeSpeakerSid) {
      const active = participants.find((p) => (p.sid || p.identity) === activeSpeakerSid);
      if (active) return active;
    }
    return participants[0] || null;
  }, [activeSpeakerSid, participants, screenParticipants]);

  if (!activeRoom || connectionState !== 'connected') return null;

  // Render Funktion für einzelne Kacheln
  const renderTile = (participant: LocalParticipant | RemoteParticipant, isScreenShare = false) => {
    const isSpeaking = activeSpeakerSid === (participant.sid || participant.identity) && !participant.isLocal;
    const isLocal = participant.isLocal;
    
    // WICHTIG: Track Publication explizit suchen, um Schwarzbild bei Local User zu vermeiden
    let publication: TrackPublication | undefined;
    if (isScreenShare) {
      publication = participant.getTrackPublication(Track.Source.ScreenShare);
    } else {
      publication = participant.getTrackPublication(Track.Source.Camera);
    }

    // Prüfen, ob Video "da" ist (Enabled und nicht Muted)
    // Bei Remote muss es subscribed sein, bei Local existieren.
    const isTrackEnabled = publication && !publication.isMuted && (isLocal || publication.isSubscribed);

    // Styling
    const borderColor = isSpeaking ? 'border-green-500 ring-1 ring-green-500' : 'border-[#202225] hover:border-[#303236]';
    // ScreenShare: 'contain' (nichts abschneiden), Kamera: 'cover' (füllen)
    const objectFit = isScreenShare ? 'object-contain' : 'object-cover';
    // Dunklerer Hintergrund für ScreenShare, damit Ränder weniger auffallen
    const bgColor = isScreenShare ? 'bg-[#000000]' : 'bg-[#2b2d31]';

    return (
      <div 
        key={`${participant.sid}-${isScreenShare ? 'scr' : 'cam'}`} 
        className={`relative rounded-xl overflow-hidden ${bgColor} transition-all border-2 ${borderColor} w-full h-full group shadow-md flex flex-col`}
      >
        {isTrackEnabled ? (
           <ParticipantTile
              trackRef={{ 
                participant, 
                source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera,
                publication: publication // <--- FIX: Explizite Publication übergeben
              }}
              className={`w-full h-full ${objectFit} bg-black`}
              style={{ width: '100%', height: '100%' }}
              onParticipantClick={() => { /* Optional: Pin Feature */ }}
            />
        ) : (
            // Placeholder: Wenn Track enabled sein sollte, aber keine Daten da sind (oder Kamera aus)
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#2b2d31] text-gray-400 gap-2">
                 {isScreenShare ? (
                    <>
                        <Monitor size={40} className="text-gray-600 animate-pulse" />
                        <span className="text-xs font-medium">Lade Stream...</span>
                    </>
                 ) : (
                    <div className={`rounded-full p-4 lg:p-6 bg-[#5865f2] ${isSpeaking ? 'animate-pulse ring-4 ring-green-500/30' : ''}`}>
                        <User size={40} className="text-white" />
                    </div>
                 )}
            </div>
        )}
        
        {/* Name Tag Overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-white max-w-[85%] z-20 pointer-events-none border border-white/5">
            {isScreenShare ? <Monitor size={12} className="text-indigo-300" /> : (!participant.isMicrophoneEnabled && <MicOff size={12} className="text-red-400"/>)}
            <span className="text-xs font-bold truncate tracking-wide text-gray-100 shadow-sm">
                {participant.name || participant.identity || (isLocal ? 'Du' : 'Benutzer')}
                {isScreenShare && <span className="font-normal text-gray-400 ml-1 opacity-80">(Live)</span>}
            </span>
        </div>

        {/* Warnung bei gemutetem Video Track (selten, aber möglich) */}
        {publication && publication.isMuted && isScreenShare && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center text-gray-400">
                    <AlertCircle size={32} className="mb-2"/>
                    <span className="text-xs">Übertragung pausiert</span>
                </div>
            </div>
        )}
      </div>
    );
  };

  // --- Layout Rendering ---

  // SPEAKER VIEW
  if (layout === 'speaker' && focusParticipant) {
    return (
        <div className="flex flex-col lg:flex-row h-full p-4 gap-3">
            {/* Main Stage (Großes Bild) */}
            <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl bg-[#000000] border border-white/5 relative">
                 {renderTile(focusParticipant, focusParticipant.isScreenShareEnabled)}
            </div>
            
            {/* Sidebar (Andere Teilnehmer) */}
            <div className="h-32 lg:h-auto lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:pr-1 custom-scrollbar">
                {participants.filter(p => p !== focusParticipant).map(p => (
                    <div key={p.sid} className="w-48 lg:w-full h-full lg:h-36 flex-none">
                        {renderTile(p, false)}
                    </div>
                ))}
            </div>
        </div>
    )
  }

  // GRID VIEW (Standard)
  const gridCols = participants.length === 1 ? 'grid-cols-1 max-w-4xl' 
                 : participants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl'
                 : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <div className={`grid gap-3 w-full ${gridCols} auto-rows-[minmax(200px,1fr)] md:auto-rows-fr aspect-video max-h-full`}>
            {/* 1. Erst alle Kameras rendern */}
            {participants.map((p) => renderTile(p, false))}
            
            {/* 2. Dann alle Screen Shares (inkl. eigenem) rendern */}
            {screenParticipants.map((p) => renderTile(p, true))}
        </div>
    </div>
  );
};