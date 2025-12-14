import { useEffect, useMemo, useState } from 'react';
import { MicOff, Monitor, Video, Volume2 } from 'lucide-react';
import { RoomEvent } from 'livekit-client';
import { useVoice } from '../../context/voice-state';

type VoicePerson = {
  sid: string;
  label: string;
  isLocal: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
};

/**
 * Shows who is currently in the voice call and highlights active speakers.
 */
export const VoiceParticipantsPanel = () => {
  const { activeRoom, connectionState } = useVoice();
  const [people, setPeople] = useState<VoicePerson[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<Set<string>>(new Set());

  const roomAny = activeRoom as any;

  const refresh = () => {
    if (!roomAny) {
      setPeople([]);
      return;
    }

    const local = roomAny.localParticipant;
    const remoteMap: Map<string, any> = roomAny.participants ?? roomAny.remoteParticipants ?? new Map();
    const remotes = Array.from(remoteMap.values());

    const list: any[] = [local, ...remotes].filter(Boolean);

    const next: VoicePerson[] = list.map((p: any) => {
      const sid = String(p?.sid || (p?.identity ?? p?.name ?? 'local'));
      const label = String(p?.name || p?.identity || p?.metadata || (p?.isLocal ? 'Du' : 'User'));
      const micEnabled = typeof p?.isMicrophoneEnabled === 'boolean' ? p.isMicrophoneEnabled : true;
      const isLocal = !!p?.isLocal || p === local;
      const cameraEnabled = !!p?.isCameraEnabled;
      const screenShareEnabled = !!p?.isScreenShareEnabled;
      return { sid, label, isLocal, micEnabled, cameraEnabled, screenShareEnabled };
    });

    // Sort: local first, then alphabetically
    next.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.label.localeCompare(b.label);
    });

    setPeople(next);
  };

  useEffect(() => {
    if (!activeRoom || connectionState !== 'connected') {
      setPeople([]);
      setActiveSpeakerSids(new Set());
      return;
    }

    refresh();

    const handleSpeakers = (speakers: any[]) => {
      setActiveSpeakerSids(new Set((speakers || []).map((s) => String(s?.sid))));
    };

    activeRoom.on(RoomEvent.ParticipantConnected, refresh);
    activeRoom.on(RoomEvent.ParticipantDisconnected, refresh);
    activeRoom.on(RoomEvent.LocalTrackPublished, refresh);
    activeRoom.on(RoomEvent.LocalTrackUnpublished, refresh);
    activeRoom.on(RoomEvent.TrackPublished, refresh);
    activeRoom.on(RoomEvent.TrackUnpublished, refresh);
    activeRoom.on(RoomEvent.TrackMuted, refresh);
    activeRoom.on(RoomEvent.TrackUnmuted, refresh);
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, handleSpeakers);

    return () => {
      activeRoom.off(RoomEvent.ParticipantConnected, refresh);
      activeRoom.off(RoomEvent.ParticipantDisconnected, refresh);
      activeRoom.off(RoomEvent.LocalTrackPublished, refresh);
      activeRoom.off(RoomEvent.LocalTrackUnpublished, refresh);
      activeRoom.off(RoomEvent.TrackPublished, refresh);
      activeRoom.off(RoomEvent.TrackUnpublished, refresh);
      activeRoom.off(RoomEvent.TrackMuted, refresh);
      activeRoom.off(RoomEvent.TrackUnmuted, refresh);
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, connectionState]);

  const countLabel = useMemo(() => {
    if (!people.length) return '';
    return `${people.length} im Talk`;
  }, [people.length]);

  if (!activeRoom || connectionState !== 'connected') return null;

  return (
    <div className="bg-[#0b0c0f] border-t border-white/5 px-2 py-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Teilnehmer</div>
        <div className="text-[10px] text-gray-600">{countLabel}</div>
      </div>

      <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
        {people.map((p) => {
          const isSpeaking = activeSpeakerSids.has(p.sid);
          return (
            <div
              key={p.sid}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${
                isSpeaking
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-white/10'}`}
                title={isSpeaking ? 'Spricht gerade' : 'Leise'}
              />

              <div className="flex-1 truncate text-xs text-gray-200">
                {p.label}
                {p.isLocal ? <span className="text-gray-500"> (du)</span> : null}
              </div>

              <div className="flex items-center gap-1">
                {p.cameraEnabled && (
                  <span title="Kamera aktiv">
                    <Video size={14} className="text-cyan-300" />
                  </span>
                )}
                {p.screenShareEnabled && (
                  <span title="Screenshare aktiv">
                    <Monitor size={14} className="text-indigo-300" />
                  </span>
                )}
                {p.micEnabled ? (
                  <Volume2 size={14} className={isSpeaking ? 'text-green-400' : 'text-gray-500'} />
                ) : (
                  <MicOff size={14} className="text-red-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
