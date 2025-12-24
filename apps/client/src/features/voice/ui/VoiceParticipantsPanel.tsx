import { useCallback, useEffect, useMemo, useState } from 'react';
import { MicOff, Monitor, Video, Volume2 } from 'lucide-react';
import { RoomEvent, Track } from 'livekit-client';
import { useVoice } from '..';
import { useSettings } from '../../../context/SettingsContext';

export const VoiceParticipantsPanel = () => {
  const { activeRoom, connectionState } = useVoice();
  const { settings, updateTalk } = useSettings();
  const [people, setPeople] = useState<any[]>([]);
  const [activeSpeakerSids, setActiveSpeakerSids] = useState<Set<string>>(new Set());

  const refresh = () => {
    if (!activeRoom || connectionState !== 'connected') return setPeople([]);
    const list = [activeRoom.localParticipant, ...Array.from(activeRoom.remoteParticipants.values())];
    setPeople(list.map(p => ({
        sid: p.sid,
        label: p.name || (p.isLocal ? 'Du' : 'User'),
        isLocal: p.isLocal,
        micEnabled: p.isMicrophoneEnabled
    })));
  };

  useEffect(() => {
    if (!activeRoom) return;
    activeRoom.on(RoomEvent.ParticipantConnected, refresh);
    activeRoom.on(RoomEvent.ParticipantDisconnected, refresh);
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, (s) => setActiveSpeakerSids(new Set(s.map(i => i.sid))));
    refresh();
    return () => { activeRoom.off(RoomEvent.ParticipantConnected, refresh); activeRoom.off(RoomEvent.ParticipantDisconnected, refresh); };
  }, [activeRoom, connectionState]);

  return (
    <div className="bg-surface border-t border-border px-2 py-3 shadow-glass">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Teilnehmer</div>
        <div className="text-[10px] text-accent font-medium">{people.length} im Talk</div>
      </div>

      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
        {people.map((p) => {
          const isSpeaking = activeSpeakerSids.has(p.sid);
          return (
            <div key={p.sid} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-colors ${isSpeaking ? 'bg-accent/10 border-accent/20' : 'bg-surface-alt border-border hover:bg-surface-hover'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-accent animate-pulse' : 'bg-text-muted/30'}`} />
              <div className="flex-1 truncate text-xs text-text">{p.label}</div>
              {!p.isLocal && (
                  <input type="range" className="w-16 accent-accent h-1 cursor-pointer" />
              )}
              {!p.micEnabled && <MicOff size={12} className="text-red-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};