import { useCallback, useEffect, useMemo } from 'react';
import { MicOff, Monitor, Video, Volume2 } from 'lucide-react';
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
  const { participants, activeSpeakerIds, connectionState, outputVolume, setParticipantVolume } = useVoice();
  const { settings, updateTalk } = useSettings();

  const savedVolumes = settings.talk.participantVolumes || {};

  const handleVolumeChange = useCallback(
    (sid: string, volumePercent: number) => {
      const volume = Math.max(0, Math.min(2, volumePercent / 100));
      updateTalk({
        participantVolumes: {
          ...savedVolumes,
          [sid]: volume,
        },
      });
      setParticipantVolume?.(sid, volume);
    },
    [savedVolumes, setParticipantVolume, updateTalk]
  );

  useEffect(() => {
    if (connectionState !== 'connected') return;
    participants
      .filter((p) => !p.isLocal)
      .forEach((p) => {
        const baseVolume = savedVolumes[p.id] ?? 1;
        setParticipantVolume?.(p.id, baseVolume);
      });
  }, [connectionState, participants, savedVolumes, setParticipantVolume, outputVolume]);

  const displayPeople: VoicePerson[] = useMemo(() => {
    const mapped = participants.map((p) => ({
      sid: p.id,
      label: p.name,
      isLocal: p.isLocal,
      micEnabled: p.isMicrophoneEnabled,
      cameraEnabled: p.isCameraEnabled,
      screenShareEnabled: p.isScreenShareEnabled,
    }));

    mapped.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.label.localeCompare(b.label);
    });
    return mapped;
  }, [participants]);

  const hasRemoteParticipants = useMemo(() => displayPeople.some((p) => !p.isLocal), [displayPeople]);
  const isConnected = connectionState === 'connected';
  const activeSpeakerSidSet = useMemo(() => new Set(activeSpeakerIds), [activeSpeakerIds]);

  const countLabel = useMemo(() => {
    if (!displayPeople.length) return '';
    return `${displayPeople.length} im Talk`;
  }, [displayPeople.length]);

  if (!isConnected || !hasRemoteParticipants) {
    return null;
  }

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
          const isSpeaking = activeSpeakerSidSet.has(p.sid);
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
