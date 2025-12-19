import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantTile } from '@livekit/components-react';
import { RoomEvent, Track, LocalParticipant, RemoteParticipant, TrackPublication } from 'livekit-client';
import { useVoice } from '../../context/voice-state';
import { Monitor, User, MicOff, AlertCircle, Maximize2, Minimize2, Dock, Move, Maximize, Minimize } from 'lucide-react';

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
  const [fullscreenElement, setFullscreenElement] = useState<Element | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const stageScreenRef = useRef<HTMLDivElement | null>(null);
  const floatingOverlayRef = useRef<HTMLDivElement | null>(null);

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
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed
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
    return [local, ...remotes];
  }, [activeRoom, refreshToken]);

  // Filter für Screen-Shares
  const screenParticipants = useMemo(() =>
    participants.filter((p) => p.isScreenShareEnabled),
  [participants]);

  const showFloatingOverlay = floatingScreenShare && screenParticipants.length > 0;
  const floatingParticipant = showFloatingOverlay ? screenParticipants[0] : null;
  const participantsWithoutScreens = useMemo(
    () => (showFloatingOverlay ? participants.filter((p) => !p.isScreenShareEnabled) : participants),
    [participants, showFloatingOverlay],
  );
  const screenParticipantsForStage = showFloatingOverlay ? [] : screenParticipants;

  // Fokus-Teilnehmer ermitteln
  const focusParticipant = useMemo(() => {
    const availableParticipants = participantsWithoutScreens;
    if (availableParticipants.length === 0 && floatingParticipant) return floatingParticipant;
    if (screenParticipantsForStage.length) return screenParticipantsForStage[0];
    if (activeSpeakerSid) {
      const active = availableParticipants.find((p) => (p.sid || p.identity) === activeSpeakerSid);
      if (active) return active;
    }
    return availableParticipants[0] || null;
  }, [activeSpeakerSid, floatingParticipant, participantsWithoutScreens, screenParticipantsForStage]);

  if (!activeRoom || connectionState !== 'connected') return null;

  useEffect(() => {
    if (!showFloatingOverlay) {
      setOverlayPosition({ x: 0, y: 0 });
      setIsOverlayMaximized(false);
    }
  }, [showFloatingOverlay]);

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreenElement(document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreenFor = async (target: HTMLElement | null) => {
    if (!target) return;
    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await target.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen toggle failed', err);
    }
  };

  const isFullscreenTarget = (target: Element | null | undefined) => document.fullscreenElement === target;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isOverlayMaximized) return;
    setDragging(true);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      baseX: overlayPosition.x,
      baseY: overlayPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setOverlayPosition({ x: dragStartRef.current.baseX + dx, y: dragStartRef.current.baseY + dy });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Render Funktion für einzelne Kacheln
  const renderTile = (
    participant: LocalParticipant | RemoteParticipant,
    isScreenShare = false,
    fullscreenRef?: React.RefObject<HTMLDivElement>,
    allowFullscreen = false,
  ) => {
    const isSpeaking = activeSpeakerSid === (participant.sid || participant.identity) && !participant.isLocal;
    const isLocal = participant.isLocal;
    
    let publication: TrackPublication | undefined;
    if (isScreenShare) {
      publication = participant.getTrackPublication(Track.Source.ScreenShare);
    } else {
      publication = participant.getTrackPublication(Track.Source.Camera);
    }

    const isTrackEnabled = publication && !publication.isMuted && (isLocal || publication.isSubscribed);

    // Styling Logic
    let borderColor = 'border-[#202225] hover:border-[#303236]';
    
    if (isScreenShare) {
        // HIER IST DIE WICHTIGE ÄNDERUNG: Immer Schwarz bei Screenshare
        borderColor = 'border-black';
    } else if (isSpeaking) {
        // Nur bei Kamera grün
        borderColor = 'border-green-500 ring-1 ring-green-500';
    }

    const objectFit = isScreenShare ? 'object-contain' : 'object-cover';
    const bgColor = isScreenShare ? 'bg-[#000000]' : 'bg-[#2b2d31]';

    return (
      <div
        key={`${participant.sid}-${isScreenShare ? 'scr' : 'cam'}`}
        ref={fullscreenRef}
        className={`relative rounded-xl overflow-hidden ${bgColor} transition-all border-2 ${borderColor} w-full h-full group shadow-md flex flex-col`}
      >
        {isTrackEnabled ? (
           <ParticipantTile
              trackRef={{
                participant, 
                source: isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera,
                publication: publication
              }}
              // WICHTIG: Hier fügen wir 'screenshare-tile' hinzu, damit unser CSS greift!
              className={`w-full h-full ${objectFit} bg-black ${isScreenShare ? 'screenshare-tile' : ''}`}
              style={{ width: '100%', height: '100%' }}
            />
        ) : (
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
        
        {/* Name Tag */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-white max-w-[85%] z-20 pointer-events-none border border-white/5">
            {isScreenShare ? <Monitor size={12} className="text-indigo-300" /> : (!participant.isMicrophoneEnabled && <MicOff size={12} className="text-red-400"/>)}
            <span className="text-xs font-bold truncate tracking-wide text-gray-100 shadow-sm">
                {participant.name || participant.identity || (isLocal ? 'Du' : 'Benutzer')}
                {isScreenShare && <span className="font-normal text-gray-400 ml-1 opacity-80">(Live)</span>}
            </span>
        </div>

        {isScreenShare && allowFullscreen && (
          <button
            className="absolute top-2 right-2 z-30 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition"
            onClick={(e) => { e.stopPropagation(); toggleFullscreenFor(fullscreenRef?.current || null); }}
            title={isFullscreenTarget(fullscreenRef?.current) ? 'Vollbild verlassen' : 'Bildschirmübertragung im Vollbild ansehen'}
          >
            {isFullscreenTarget(fullscreenRef?.current) ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}

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
        <div className="flex flex-col lg:flex-row h-full p-4 gap-3 relative">
            <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl bg-[#000000] border border-white/5 relative">
                 {renderTile(
                   focusParticipant,
                   focusParticipant.isScreenShareEnabled,
                   focusParticipant.isScreenShareEnabled ? stageScreenRef : undefined,
                   focusParticipant.isScreenShareEnabled,
                 )}
            </div>

            <div className="h-32 lg:h-auto lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:pr-1 custom-scrollbar">
                {participantsWithoutScreens.filter(p => p !== focusParticipant).map(p => (
                    <div key={p.sid} className="w-48 lg:w-full h-full lg:h-36 flex-none">
                        {renderTile(p, false)}
                    </div>
                ))}
            </div>

            {showFloatingOverlay && floatingParticipant && (
              <FloatingOverlay
                isMaximized={isOverlayMaximized}
                isFullscreen={isFullscreenTarget(floatingOverlayRef.current)}
                onToggleMaximize={() => setIsOverlayMaximized((prev) => !prev)}
                onToggleFullscreen={() => toggleFullscreenFor(floatingOverlayRef.current)}
                onAnchor={onRequestAnchor}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerLeave={stopDragging}
                overlayPosition={overlayPosition}
                dragging={dragging}
                containerRef={floatingOverlayRef}
              >
                {renderTile(floatingParticipant, true)}
              </FloatingOverlay>
            )}
        </div>
    )
  }

  // GRID VIEW (Standard)
  const gridCols = participantsWithoutScreens.length === 1 ? 'grid-cols-1 max-w-4xl'
                 : participantsWithoutScreens.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl'
                 : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center relative">
        <div className={`grid gap-3 w-full ${gridCols} auto-rows-[minmax(200px,1fr)] md:auto-rows-fr aspect-video max-h-full`}>
            {participantsWithoutScreens.map((p) => renderTile(p, false))}
            {screenParticipantsForStage.map((p, index) => renderTile(p, true, index === 0 ? stageScreenRef : undefined, index === 0))}
        </div>

        {showFloatingOverlay && floatingParticipant && (
          <FloatingOverlay
            isMaximized={isOverlayMaximized}
            isFullscreen={isFullscreenTarget(floatingOverlayRef.current)}
            onToggleMaximize={() => setIsOverlayMaximized((prev) => !prev)}
            onToggleFullscreen={() => toggleFullscreenFor(floatingOverlayRef.current)}
            onAnchor={onRequestAnchor}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerLeave={stopDragging}
            overlayPosition={overlayPosition}
            dragging={dragging}
            containerRef={floatingOverlayRef}
          >
            {renderTile(floatingParticipant, true)}
          </FloatingOverlay>
        )}
    </div>
  );
};

type FloatingOverlayProps = {
  isMaximized: boolean;
  isFullscreen: boolean;
  onToggleMaximize: () => void;
  onToggleFullscreen: () => void;
  onAnchor?: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  overlayPosition: { x: number; y: number };
  dragging: boolean;
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
};

const FloatingOverlay = ({ isMaximized, isFullscreen, onToggleMaximize, onToggleFullscreen, onAnchor, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, overlayPosition, dragging, children, containerRef }: FloatingOverlayProps) => {
  return (
    <div
      ref={containerRef}
      className={`fixed md:absolute z-40 ${isMaximized ? 'inset-4 md:inset-6' : 'bottom-6 right-6 w-72 md:w-96 aspect-video'} rounded-2xl overflow-hidden border border-white/10 bg-black/70 shadow-2xl backdrop-blur-lg transition-all duration-200 relative`}
      style={!isMaximized ? { transform: `translate3d(${overlayPosition.x}px, ${overlayPosition.y}px, 0)` } : undefined}
    >
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between gap-2 px-3 py-2 bg-black/60 text-white text-xs font-semibold ${isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <div className="flex items-center gap-1 text-[11px] tracking-wide uppercase">
          <Move size={14} className={`text-gray-300 ${dragging ? 'animate-pulse' : ''}`} />
          <span>Screen Share PiP</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleFullscreen}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={isFullscreen ? 'Vollbild verlassen' : 'Vollbild'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
          <button
            onClick={onToggleMaximize}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={isMaximized ? 'Floating-Ansicht' : 'Maximieren'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {onAnchor && (
            <button
              onClick={onAnchor}
              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="In Layout verankern"
            >
              <Dock size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="w-full h-full pt-8">
        {children}
      </div>
    </div>
  );
};