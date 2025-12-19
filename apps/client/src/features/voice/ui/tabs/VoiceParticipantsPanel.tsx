import { useCallback, useEffect, useMemo, useState } from 'react';
import { MicOff, Monitor, Video, Volume2 } from 'lucide-react';
import { RoomEvent, Track } from 'livekit-client';
import { useVoice } from '../..';
import { useSettings } from '../../../../context/SettingsContext';

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
  const { activeRoom, connectionState, outputVolume } = useVoice();
  const { settings, updateTalk } = useSettings();
  const [people, setPeople] = useState<VoicePerson[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<Set<string>>(new Set());

  const roomAny = activeRoom as any;

  const refresh = () => {
    if (!roomAny || connectionState !== 'connected') {
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

  const savedVolumes = settings.talk.participantVolumes || {};

  const applyVolumeToParticipant = useCallback(
    (sid: string, volumeOverride?: number) => {
      if (!activeRoom) return;
      const participant = activeRoom.remoteParticipants.get(sid);
      if (!participant) return;

      const volume = (volumeOverride ?? savedVolumes[sid] ?? 1) * (outputVolume ?? 1);

      participant.setVolume(volume);
    },
    [activeRoom, outputVolume, savedVolumes]
  );

  const handleVolumeChange = useCallback(
    (sid: string, volumePercent: number) => {
      const volume = Math.max(0, Math.min(2, volumePercent / 100));
      updateTalk({
        participantVolumes: {
          ...savedVolumes,
          [sid]: volume,
        },
      });
      applyVolumeToParticipant(sid, volume);
    },
    [applyVolumeToParticipant, savedVolumes, updateTalk]
  );

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

    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (participant && !participant.isLocal && track.kind === Track.Kind.Audio) {
        applyVolumeToParticipant(participant.sid);
      }
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
    activeRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

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
      activeRoom.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, applyVolumeToParticipant, connectionState]);

  useEffect(() => {
    if (!activeRoom || connectionState !== 'connected') return;
    Array.from(activeRoom.remoteParticipants.values()).forEach((p) => {
      applyVolumeToParticipant(p.sid);
    });
  }, [activeRoom, applyVolumeToParticipant, connectionState, savedVolumes]);

  const hasRemoteParticipants = useMemo(() => people.some((p) => !p.isLocal), [people]);
  const isConnected = connectionState === 'connected';

  // --- FIX: Hook nach oben verschoben, VOR das return ---
  const countLabel = useMemo(() => {
    if (!people.length) return '';
    return `${people.length} im Talk`;
  }, [people.length]);

  if (!isConnected || !hasRemoteParticipants) {
    return null;
  }

  const displayPeople = people;
  const displaySpeakerSids = activeSpeakerSids;

  return (
    <div className="bg-[#0b0c0f] border-t border-white/5 px-2 py-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Teilnehmer</div>
        <div className="text-[10px] text-gray-600">{countLabel}</div>
      </div>

      <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
        {displayPeople.length === 0 && (
          <div className="px-2 py-1 text-[11px] text-gray-500">Niemand im Talk</div>
        )}
        {displayPeople.map((p) => {
          const isSpeaking = displaySpeakerSids.has(p.sid);
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

              {!p.isLocal && (
                <div className="flex items-center gap-2 pl-2 min-w-[120px]">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={Math.round((savedVolumes[p.sid] ?? 1) * 100)}
                    onChange={(e) => handleVolumeChange(p.sid, Number(e.target.value))}
                    className="w-24 accent-cyan-400"
                    title="Lautstärke anpassen"
                  />
                  <span className="text-[10px] text-gray-400 w-8 text-right">
                    {Math.round((savedVolumes[p.sid] ?? 1) * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};