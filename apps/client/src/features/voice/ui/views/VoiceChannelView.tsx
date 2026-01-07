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

import type { VoiceParticipant } from '../../providers/types';
import { useVoice } from '../..'; 
// 3. Settings und Modals (vier Ebenen hoch bis src/)
import { useSettings } from '../../../../context/SettingsContext';
import { UserSettingsModal } from '../../../../components/modals/UserSettingsModal';
import { StatusBadge, type StatusTone } from '../../../../components/ui';

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

  const canRenderStage = Boolean(MediaStage) && connectionState === 'connected';
  const streamingActive = streamState === 'live';
  const streamPaused = streamState === 'paused';
  const canStartStream = connectionState !== 'disconnected' || Boolean(activeChannelId);
  const streamStatusVariant = (streamingActive
    ? 'live'
    : streamPaused
      ? 'paused'
      : connectionState === 'connected'
        ? 'idle'
        : 'offline') as StatusTone;
  const streamLabel = streamingActive ? 'LIVE' : streamPaused ? 'PAUSIERT' : connectionState === 'connected' ? 'BEREIT' : 'OFFLINE';
  const streamDetail = streamingActive
    ? (isScreenSharing ? 'Bildschirmfreigabe aktiv' : 'Kamera aktiv')
    : streamPaused
      ? 'Stream angehalten'
      : connectionState === 'connected'
        ? 'Warte auf Stream'
        : 'Nicht verbunden';

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
  const participantCountLabel = `${participants.length} Teilnehmer`;

  const galleryParticipants: VoiceParticipant[] = participants.length > 0 ? participants : [{
    id: 'placeholder',
    name: channelName || 'Warte auf Teilnehmer',
    isLocal: false,
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    isScreenShareEnabled: false,
    metadata: null,
  }];

  return (
    <div className="voice-channel-view">
      <div className="voice-topbar">
        <StatusBadge status={streamStatusVariant} withDot size="md">
          {streamLabel}
        </StatusBadge>

        <div className="voice-topbar__meta">
          <div className="streamer-pill inline">
            <div className="streamer-av">
              {(localParticipant?.name || channelName || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="streamer-meta">
              <span className="streamer-name">{localParticipant?.name || channelName || 'Unbekannt'}</span>
              <span className="streamer-status">{streamDetail}</span>
            </div>
          </div>

          <div className="voice-topbar__channel">
            <Monitor size={14} />
            <span>{channelName || 'Unbenannter Stream'}</span>
          </div>
        </div>

        <div className="voice-topbar__actions">
          <button className={`sp-btn ${layout === 'grid' ? 'active' : ''}`} onClick={() => setLayout('grid')} title="Gitter">
            <Grid size={16} />
          </button>
          <button className={`sp-btn ${layout === 'speaker' ? 'active' : ''}`} onClick={() => setLayout('speaker')} title="Speaker">
            <LayoutList size={16} />
          </button>
        </div>
      </div>

      <div className="stream-stage">
        <div className="stream-view">
          <div className="stream-view__content">
            {canRenderStage && MediaStage ? (
              <MediaStage
                layout={layout}
                participants={participants}
                activeSpeakerIds={activeSpeakerIds}
                connectionState={connectionState}
                nativeHandle={nativeHandle}
              />
            ) : (
              <div className="stream-fallback">
                {connectionState === 'connected' ? 'Voice-Provider wird initialisiert...' : 'Verbinde...'}
              </div>
            )}
          </div>

          <div className="stream-overlay-top">
            <div className={`live-tag ${streamStatusVariant}`}>
              {streamingActive ? <Play size={12} /> : streamPaused ? <Pause size={12} /> : <Square size={12} />}
              <span>{streamLabel}</span>
            </div>
            <div className="streamer-pill">
              <div className="streamer-av">
                {(localParticipant?.name || channelName || 'S').slice(0, 1).toUpperCase()}
              </div>
              <div className="streamer-meta">
                <span className="streamer-name">{localParticipant?.name || channelName || 'Unbekannt'}</span>
                <span className="streamer-status">{streamDetail}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="stream-error">
              <XCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="stream-gallery">
          {galleryParticipants.map((p) => {
            const isSpeaking = activeSpeakerIds.includes(p.id);
            const hasMedia = p.isScreenShareEnabled || p.isCameraEnabled;

            return (
              <div
                key={p.id}
                className={`stream-thumb ${isSpeaking ? 'active' : ''} ${hasMedia ? 'live' : ''} ${p.id === 'placeholder' ? 'placeholder' : ''}`}
              >
                <div className="thumb-avatar">
                  {(p.name || 'Gast').slice(0, 1).toUpperCase()}
                </div>
                <div className="thumb-info">
                  <div className="thumb-name">
                    <span>{p.name || 'Gast'}</span>
                    {p.isLocal && <span className="thumb-chip">Du</span>}
                  </div>
                  <div className="thumb-meta">
                    {p.isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                    {p.isCameraEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                    {p.isScreenShareEnabled && <Monitor size={14} />}
                  </div>
                </div>
                {hasMedia && <div className="thumb-live-dot" />}
              </div>
            );
          })}
        </div>

        <div className="stream-panel">
          <div className="sp-left">
            <div className="sp-info">
              <div className="sp-title">{channelName || 'Voice Stream'}</div>
              <div className="sp-sub">{participantCountLabel} • {connectionState === 'connected' ? 'Verbunden' : 'Getrennt'} • {streamDetail}</div>
            </div>
            <div className="sp-actions">
              <button
                onClick={handleStartStream}
                disabled={streamAction === 'start' || !canStartStream}
                className={`sp-btn ${streamingActive ? 'active' : ''}`}
              >
                <Play size={16} /> {streamPaused ? 'Fortsetzen' : 'Stream starten'}
              </button>
              <button
                onClick={handlePauseStream}
                disabled={streamAction === 'pause' || streamState === 'idle'}
                className={`sp-btn ${streamPaused ? 'warning' : ''}`}
              >
                <Pause size={16} /> Pause
              </button>
              <button
                onClick={handleStopStream}
                disabled={streamAction === 'stop' || streamState === 'idle'}
                className="sp-btn danger"
              >
                <Square size={16} /> Stop
              </button>
            </div>
          </div>

          <div className="sp-right">
            <div className="sp-group">
              <div className="control-with-menu">
                <button
                  className={`sp-btn ${!micMuted ? 'active' : 'muted'}`}
                  onClick={() => setMicMuted(!micMuted)}
                >
                  {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button className="sp-btn" onClick={() => setMenuOpen(menuOpen === 'mic' ? null : 'mic')}>
                  <ChevronUp size={14} />
                </button>
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
              </div>
              <button
                className={`sp-btn ${!muted ? 'active' : 'muted'}`}
                onClick={() => setMuted(!muted)}
              >
                <Headphones size={16} />
              </button>
            </div>

            <div className="sp-group">
              <button
                className={`sp-btn ${isCameraEnabled ? 'active' : ''}`}
                onClick={toggleCamera}
              >
                {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
              <button
                className={`sp-btn ${isScreenSharing ? 'active' : ''}`}
                onClick={() => isScreenSharing ? stopScreenShare() : toggleScreenShare()}
              >
                <Monitor size={16} />
              </button>
            </div>

            <div className="sp-group">
              <button className="sp-btn" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
              <button className="sp-btn" onClick={handleOpenExternal}>
                <ExternalLink size={16} />
              </button>
              <button className="sp-btn danger" onClick={handleDisconnect}>
                <Power size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} initialCategory="devices" />}
    </div>
  );
};
