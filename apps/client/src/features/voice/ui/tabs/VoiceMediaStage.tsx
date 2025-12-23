import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track, LocalParticipant, RemoteParticipant, TrackPublication, Participant } from 'livekit-client';
import {
  AlertCircle,
  Dock,
  Maximize,
  Maximize2,
  Minimize,
  Minimize2,
  MicOff,
  Monitor,
  Move,
} from 'lucide-react';
import { useVoice } from '../..';

type LayoutMode = 'grid' | 'speaker';

export const VoiceMediaStage = ({
  layout,
  floatingScreenShare,
  onRequestAnchor,
}: {
  layout: LayoutMode;
  floatingScreenShare?: boolean;
  onRequestAnchor?: () => void;
}) => {
  const { activeRoom, connectionState } = useVoice();
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 });
  const [isOverlayMaximized, setIsOverlayMaximized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const stageScreenRef = useRef<HTMLDivElement | null>(null);
  const floatingOverlayRef = useRef<HTMLDivElement | null>(null);

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
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.ParticipantMetadataChanged
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
    return [activeRoom.localParticipant, ...Array.from(activeRoom.remoteParticipants.values())];
  }, [activeRoom, refreshToken]);

  const participantsWithoutScreens = useMemo(() => participants.filter(p => !p.isScreenShareEnabled), [participants]);
  const screenParticipants = useMemo(() => participants.filter(p => p.isScreenShareEnabled), [participants]);

  const renderTile = (participant: Participant, isScreenShare = false) => {
    const isSpeaking = activeSpeakerSid === (participant.sid || participant.identity);
    
    // Metadaten für Avatar extrahieren
    let metadata: { avatar?: string; displayName?: string } = {};
    try {
      metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch (e) {
      console.warn("Failed to parse participant metadata", e);
    }

    const publication = isScreenShare 
      ? participant.getTrackPublication(Track.Source.ScreenShare)
      : participant.getTrackPublication(Track.Source.Camera);

    const isTrackEnabled = !!publication && !publication.isMuted && (participant.isLocal || publication.isSubscribed);

    return (
      <div key={`${participant.sid}-${isScreenShare}`} className={`relative rounded-2xl overflow-hidden bg-[#0b0c10] border-2 transition-all duration-300 shadow-xl flex flex-col ${isSpeaking ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02]' : 'border-white/5'}`}>
        
        {isTrackEnabled ? (
          <ParticipantTile
            trackRef={{ participant, source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera, publication }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1b1e] to-[#0b0c10] relative">
            {isScreenShare ? (
              <Monitor size={48} className="text-white/10 animate-pulse" />
            ) : (
              <div className="relative group">
                {/* Avatar-Darstellung */}
                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 transition-all duration-500 ${isSpeaking ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]' : 'border-white/10 group-hover:border-white/20'}`}>
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

        {/* Info Overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white pointer-events-none">
          {!participant.isMicrophoneEnabled && <MicOff size={14} className="text-red-400" />}
          <span className="text-xs font-bold tracking-wide">
            {metadata.displayName || participant.name || participant.identity}
          </span>
        </div>
      </div>
    );
  };

  if (!activeRoom || connectionState !== 'connected') return null;

  const gridCols = participantsWithoutScreens.length <= 1 ? 'grid-cols-1 max-w-3xl' : 
                   participantsWithoutScreens.length <= 4 ? 'grid-cols-2 max-w-6xl' : 'grid-cols-3';

  return (
    <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
      <div className={`grid gap-6 w-full ${gridCols} auto-rows-fr aspect-video`}>
        {participantsWithoutScreens.map(p => renderTile(p, false))}
        {screenParticipants.map(p => renderTile(p, true))}
      </div>
    </div>
  );
};