import { CheckCircle2, Headphones, Loader2, Mic, MicOff, RefreshCw, Video } from 'lucide-react';
import { useVoice } from '..';
import { Button } from '../../../components/ui/Button';

export const VoicePreJoin = ({ channel, onJoin, onCancel, isJoining }: any) => {
  const { connectionState, micMuted, setMicMuted, muted, setMuted } = useVoice();

  return (
    <div className="flex-1 flex flex-col h-full bg-background bg-aurora relative overflow-hidden">
      <div className="flex-1 flex flex-col p-8 my-auto max-w-5xl mx-auto w-full z-10">
        <div className="bg-surface/80 border border-border rounded-[2.5rem] shadow-glass p-8 backdrop-blur-xl grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8">
            
            <div className="space-y-6">
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-accent font-bold mb-1">Talk Vorbereitung</div>
                    <div className="text-3xl font-bold text-text">{channel.name}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-5 rounded-3xl border transition-all ${micMuted ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-alt border-border'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-text"><Mic size={16} className="text-accent"/> Mikrofon</div>
                            <Button size="sm" variant={micMuted ? 'danger' : 'secondary'} onClick={() => setMicMuted(!micMuted)}>{micMuted ? 'Stumm' : 'Aktiv'}</Button>
                        </div>
                    </div>
                    <div className={`p-5 rounded-3xl border transition-all ${muted ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-alt border-border'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-text"><Headphones size={16} className="text-accent"/> Sound</div>
                            <Button size="sm" variant={muted ? 'danger' : 'secondary'} onClick={() => setMuted(!muted)}>{muted ? 'Aus' : 'An'}</Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-background/40 rounded-[2rem] p-6 border border-border flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-xl shadow-neon">
                        {channel.name[0].toUpperCase()}
                    </div>
                    <div className="text-lg font-bold text-text truncate">{channel.name}</div>
                </div>
                <div className="space-y-3">
                    <Button variant="primary" size="lg" className="w-full h-14 text-base" onClick={onJoin} disabled={isJoining}>
                        {isJoining ? <Loader2 className="animate-spin" /> : 'Jetzt beitreten'}
                    </Button>
                    <Button variant="ghost" onClick={onCancel} className="w-full">Abbrechen</Button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};