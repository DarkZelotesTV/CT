import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  ExternalLink,
  Grid,
  Headphones,
  LayoutList,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Settings,
  Play,
  Power,
  Square,
  Video,
  VideoOff,
  XCircle,
  Check,
} from 'lucide-react';

import { useVoice } from '../..'; 
// 3. Settings und Modals (vier Ebenen hoch bis src/)
import { useSettings } from '../../../../context/SettingsContext';
import { UserSettingsModal } from '../../../../components/modals/UserSettingsModal';
import { IconButton, ToggleIconButton } from '../../../../components/ui/Button';

const ContextMenu = ({ onClose, children }: { onClose: () => void, children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} className="absolute bottom-[115%] left-0 w-64 bg-surface border border-border rounded-2xl shadow-glass p-1.5 z-50 text-text animate-in slide-in-from-bottom-2 duration-150">
            {children}
        </div>
    );
};

export const VoiceChannelView = ({ channelName }: { channelName: string | null }) => {
  const {
    connectionState, error,
    muted, micMuted, setMuted, setMicMuted,
    isCameraEnabled, isScreenSharing,
    stopCamera, startCamera, stopScreenShare, startScreenShare, toggleCamera, disconnect, toggleScreenShare,
    getNativeHandle,
    participants,
    activeSpeakerIds,
    providerRenderers,
    connectToChannel,
    activeChannelId,
  } = useVoice();
  const { settings, updateDevices } = useSettings();
  const MediaStage = providerRenderers.MediaStage;
  const nativeHandle = getNativeHandle?.();

  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'mic' | 'video' | 'screen' | null>(null);
  const [devices, setDevices] = useState<{audio: MediaDeviceInfo[], video: MediaDeviceInfo[]}>({ audio: [], video: [] });
  const [streamState, setStreamState] = useState<'idle' | 'live' | 'paused'>('idle');
  const [streamAction, setStreamAction] = useState<null | 'start' | 'pause' | 'stop'>(null);

  useEffect(() => {
      navigator.mediaDevices.enumerateDevices().then(devs => {
          setDevices({
              audio: devs.filter(d => d.kind === 'audioinput'),
              video: devs.filter(d => d.kind === 'videoinput')
          });
      });
  }, [menuOpen]);

  useEffect(() => {
    if (connectionState !== 'connected') {
      setStreamState('idle');
      return;
    }

    if (isScreenSharing || isCameraEnabled) {
      setStreamState('live');
      return;
    }

    if (streamState === 'live') {
      setStreamState('paused');
    }
  }, [connectionState, isCameraEnabled, isScreenSharing, streamState]);

  const handleDeviceSwitch = (type: 'audio'|'video', id: string) => {
      if (type === 'audio') updateDevices({ audioInputId: id });
      if (type === 'video') {
          updateDevices({ videoInputId: id });
          if(isCameraEnabled) { stopCamera().then(() => startCamera(settings.talk.cameraQuality)); }
      }
      setMenuOpen(null);
  };

  const statusColor = connectionState === 'connected' ? 'bg-green-500 shadow-neon' : 'bg-yellow-500';
  const canRenderStage = Boolean(MediaStage) && connectionState === 'connected';
  const streamingActive = streamState === 'live';
  const streamPaused = streamState === 'paused';
  const canStartStream = connectionState !== 'disconnected' || Boolean(activeChannelId);

  const handleStartStream = useCallback(async () => {
    if (streamAction || !canStartStream) return;
    setStreamAction('start');
    try {
      if (connectionState === 'disconnected' && activeChannelId) {
        await connectToChannel(activeChannelId, channelName ?? `Talk ${activeChannelId}`);
      }
      await startScreenShare();
      setStreamState('live');
    } finally {
      setStreamAction(null);
    }
  }, [activeChannelId, canStartStream, channelName, connectToChannel, connectionState, startScreenShare, streamAction]);

  const handlePauseStream = useCallback(async () => {
    if (streamAction || streamState === 'idle') return;
    setStreamAction('pause');
    try {
      await stopScreenShare();
      setStreamState('paused');
    } finally {
      setStreamAction(null);
    }
  }, [stopScreenShare, streamAction, streamState]);

  const handleStopStream = useCallback(async () => {
    if (streamAction) return;
    setStreamAction('stop');
    try {
      await stopScreenShare();
      setStreamState('idle');
    } finally {
      setStreamAction(null);
    }
  }, [stopScreenShare, streamAction]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setStreamState('idle');
  }, [disconnect]);

  const handleOpenExternal = useCallback(() => {
    window.open(window.location.href, '_blank', 'noreferrer');
  }, []);

  const localParticipant = participants.find((p) => p.isLocal) ?? participants[0];
  const streamLabel = streamingActive ? 'Live' : streamPaused ? 'Pausiert' : 'Bereit';

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative select-none p-4 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface/70 border border-border shadow-glass">
              <div className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="uppercase text-[11px] font-bold tracking-wide text-text">{streamLabel}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface/70 border border-border shadow-glass">
              <div className="w-8 h-8 rounded-2xl bg-accent/10 border border-accent/40 text-accent font-bold flex items-center justify-center">
                {(localParticipant?.name || channelName || 'S').slice(0, 1).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[11px] uppercase text-text-muted font-semibold">Streamer</div>
                <div className="text-sm font-bold text-text truncate max-w-[180px]">{localParticipant?.name || channelName || 'Unbekannt'}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface/70 backdrop-blur-md rounded-2xl p-1 border border-border shadow-glass">
              <IconButton size="sm" variant={layout === 'grid' ? 'primary' : 'ghost'} onClick={() => setLayout('grid')}><Grid size={18}/></IconButton>
              <IconButton size="sm" variant={layout === 'speaker' ? 'primary' : 'ghost'} onClick={() => setLayout('speaker')}><LayoutList size={18}/></IconButton>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4 flex-1 min-h-0">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-glass">
            <div className="absolute inset-0">
              {canRenderStage && MediaStage ? (
                <MediaStage
                  layout={layout}
                  participants={participants}
                  activeSpeakerIds={activeSpeakerIds}
                  connectionState={connectionState}
                  nativeHandle={nativeHandle}
                />
              ) : (
                  <div className="flex h-full items-center justify-center text-text-muted gap-2 font-semibold bg-background/50">
                     {connectionState === 'connected' ? 'Voice-Provider wird initialisiert...' : 'Verbinde...'}
                  </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border ${streamingActive ? 'bg-green-500/20 text-green-100 border-green-500/40' : streamPaused ? 'bg-amber-500/20 text-amber-100 border-amber-500/40' : 'bg-border text-text-muted border-border'}`}>
                {streamLabel}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border border-border bg-surface/80 text-text flex items-center gap-2 shadow-glass">
                <Monitor size={14} /> {channelName || 'Unbenannter Stream'}
              </span>
            </div>

            {error && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl text-xs border border-red-500/30 flex gap-2 items-center z-10">
                    <XCircle size={14}/> {error}
                </div>
            )}
          </div>

          <div className="flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl border border-border bg-surface/60 shadow-glass p-4 flex flex-col gap-3 min-h-[180px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-text">Galerie</div>
                <div className="text-xs text-text-muted">{participants.length} Teilnehmer</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-auto pr-1">
                {participants.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 p-2 rounded-xl border ${activeSpeakerIds.includes(p.id) ? 'border-accent/60 bg-accent/5 shadow-lg' : 'border-border bg-surface/80'} transition-all`}>
                    <div className="w-10 h-10 rounded-2xl bg-surface/90 border border-border flex items-center justify-center font-bold text-text">
                      {(p.name || 'Gast').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{p.name || 'Gast'}</div>
                      <div className="text-[11px] text-text-muted flex items-center gap-2">
                        {p.isMicrophoneEnabled ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
                        {p.isCameraEnabled ? <Video size={14} className="text-accent" /> : <VideoOff size={14} className="text-text-muted" />}
                        {p.isScreenShareEnabled && <Monitor size={14} className="text-amber-400" />}
                      </div>
                    </div>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-sm text-text-muted px-2 py-6 text-center border border-dashed border-border rounded-xl">
                    Warte auf Teilnehmer...
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 shadow-glass p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  onClick={handleStartStream}
                  disabled={streamAction === 'start' || !canStartStream}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed ${streamingActive ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-alt text-text border-border hover:border-accent/40 hover:text-accent'}`}
                >
                  <Play size={18} /> {streamPaused ? 'Fortsetzen' : 'Stream starten'}
                </button>
                <button
                  onClick={handlePauseStream}
                  disabled={streamAction === 'pause' || streamState === 'idle'}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed ${streamPaused ? 'bg-amber-500/20 text-amber-100 border-amber-500/40' : 'bg-surface-alt text-text border-border hover:border-amber-400/60 hover:text-amber-100'}`}
                >
                  <Pause size={18} /> Pause
                </button>
                <button
                  onClick={handleStopStream}
                  disabled={streamAction === 'stop' || streamState === 'idle'}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition bg-surface-alt text-text border-border hover:border-red-400/60 hover:text-red-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Square size={18} /> Stop
                </button>
                <button
                  onClick={handleOpenExternal}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition bg-surface-alt text-text border-border hover:border-accent/60 hover:text-accent"
                >
                  <ExternalLink size={18} /> Öffnen
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition bg-red-500/20 text-red-100 border-red-500/50 hover:bg-red-500/30"
                >
                  <Power size={18} /> Power-Off
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-1 bg-surface-alt p-1.5 rounded-2xl border border-border">
                    <ToggleIconButton pressed={!micMuted} onClick={() => setMicMuted(!micMuted)} variant={micMuted ? 'danger' : 'secondary'}>
                        {micMuted ? <MicOff size={18}/> : <Mic size={18}/>}
                    </ToggleIconButton>
                    <IconButton size="sm" variant="ghost" onClick={() => setMenuOpen(menuOpen === 'mic' ? null : 'mic')}>
                        <ChevronUp size={14} />
                    </IconButton>
                    {menuOpen === 'mic' && (
                        <ContextMenu onClose={() => setMenuOpen(null)}>
                            <div className="text-[10px] uppercase font-bold text-text-muted px-3 py-2">Eingabe</div>
                            {devices.audio.map(d => (
                                <button key={d.deviceId} onClick={() => handleDeviceSwitch('audio', d.deviceId)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 rounded-xl flex justify-between items-center text-text transition-colors">
                                    <span className="truncate">{d.label || 'Mikrofon'}</span>
                                    {settings.devices.audioInputId === d.deviceId && <Check size={14} className="text-accent"/>}
                                </button>
                            ))}
                        </ContextMenu>
                    )}
                    <div className="w-px h-6 bg-border mx-1" />
                    <ToggleIconButton pressed={!muted} onClick={() => setMuted(!muted)} variant={muted ? 'danger' : 'secondary'}>
                        <Headphones size={18} />
                    </ToggleIconButton>
                </div>

                <div className="flex items-center gap-1 bg-surface-alt p-1.5 rounded-2xl border border-border">
                    <ToggleIconButton pressed={isCameraEnabled} onClick={toggleCamera}>
                        {isCameraEnabled ? <Video size={18}/> : <VideoOff size={18}/>}
                    </ToggleIconButton>
                    <div className="w-px h-6 bg-border mx-1" />
                    <ToggleIconButton pressed={isScreenSharing} onClick={() => isScreenSharing ? stopScreenShare() : toggleScreenShare()}>
                        <Monitor size={18}/>
                    </ToggleIconButton>
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold border transition bg-surface-alt text-text border-border hover:border-accent/60 hover:text-accent"
                >
                  <Settings size={16} /> Geräte
                </button>
              </div>
            </div>
          </div>
        </div>

        {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} initialCategory="devices" />}
    </div>
  );
};
