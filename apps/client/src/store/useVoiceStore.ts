import { useCallback, useMemo, useState } from 'react';

export interface VoiceSession {
  roomName: string;
  participants: string[];
  isMuted: boolean;
}

export interface VoiceStore {
  session: VoiceSession | null;
  joinRoom: (roomName: string, participants?: string[]) => void;
  leaveRoom: () => void;
  toggleMute: () => void;
}

export const useVoiceStore = (): VoiceStore => {
  const [session, setSession] = useState<VoiceSession | null>(null);

  const joinRoom = useCallback((roomName: string, participants: string[] = []) => {
    setSession({ roomName, participants, isMuted: false });
  }, []);

  const leaveRoom = useCallback(() => {
    setSession(null);
  }, []);

  const toggleMute = useCallback(() => {
    setSession((current) =>
      current ? { ...current, isMuted: !current.isMuted } : current,
    );
  }, []);

  return useMemo(
    () => ({ session, joinRoom, leaveRoom, toggleMute }),
    [joinRoom, leaveRoom, session, toggleMute],
  );
};
