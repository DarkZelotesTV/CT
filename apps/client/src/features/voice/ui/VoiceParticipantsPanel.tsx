import { useMemo } from 'react';
import { MicOff } from 'lucide-react';
import { useVoice } from '..';

export const VoiceParticipantsPanel = () => {
  const { participants, activeSpeakerIds, connectionState } = useVoice();

  const displayPeople = useMemo(() => {
    const mapped = participants.map((p) => ({
      sid: p.id,
      label: p.name || (p.isLocal ? 'Du' : 'User'),
      isLocal: p.isLocal,
      micEnabled: p.isMicrophoneEnabled,
    }));
    mapped.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.label.localeCompare(b.label);
    });
    return mapped;
  }, [participants]);

  const activeSpeakerSet = useMemo(() => new Set(activeSpeakerIds), [activeSpeakerIds]);
  const isConnected = connectionState === 'connected';

  if (!isConnected || displayPeople.length === 0) return null;

  return (
    <div className="bg-surface border-t border-border px-2 py-3 shadow-glass">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Teilnehmer</div>
        <div className="text-[10px] text-accent font-medium">{displayPeople.length} im Talk</div>
      </div>

      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
        {displayPeople.map((p) => {
          const isSpeaking = activeSpeakerSet.has(p.sid);
          return (
            <div
              key={p.sid}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-colors ${
                isSpeaking ? 'bg-accent/10 border-accent/20' : 'bg-surface-alt border-border hover:bg-surface-hover'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-accent animate-pulse' : 'bg-text-muted/30'}`} />
              <div className="flex-1 truncate text-xs text-text">{p.label}</div>
              {!p.isLocal && <input type="range" className="w-16 accent-accent h-1 cursor-pointer" readOnly />}
              {!p.micEnabled && <MicOff size={12} className="text-red-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
