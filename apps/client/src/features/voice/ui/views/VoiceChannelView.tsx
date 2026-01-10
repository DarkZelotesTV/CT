import { useCallback, useEffect, useState } from 'react';
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
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, Menu, MenuItem, StatusBadge, type StatusTone } from '../../../../components/ui';
import './VoiceView.css';

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
    <div className="ct-voice-channel">
      <div className="ct-voice-channel__topbar">
        <StatusBadge status={streamStatusVariant} withDot size="md">
          {streamLabel}
        </StatusBadge>

        <div className="ct-voice-channel__topbar-meta">
          <div className="ct-voice-channel__streamer-pill ct-voice-channel__streamer-pill--inline">
            <div className="ct-voice-channel__streamer-avatar">
              {(localParticipant?.name || channelName || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="ct-voice-channel__streamer-meta">
              <span className="ct-voice-channel__streamer-name">{localParticipant?.name || channelName || 'Unbekannt'}</span>
              <span className="ct-voice-channel__streamer-status">{streamDetail}</span>
            </div>
          </div>

          <div className="ct-voice-channel__topbar-channel">
            <Monitor size={14} />
            <span>{channelName || 'Unbenannter Stream'}</span>
          </div>
        </div>

        <div className="ct-voice-channel__topbar-actions">
          <button className={`ct-voice-channel__control-button ${layout === 'grid' ? 'ct-voice-channel__control-button--active' : ''}`} onClick={() => setLayout('grid')} title="Gitter">
            <Grid size={16} />
          </button>
          <button className={`ct-voice-channel__control-button ${layout === 'speaker' ? 'ct-voice-channel__control-button--active' : ''}`} onClick={() => setLayout('speaker')} title="Speaker">
            <LayoutList size={16} />
          </button>
        </div>
      </div>

      <div className="ct-voice-channel__stream-stage">
        <div className="ct-voice-channel__stream-view">
          <div className="ct-voice-channel__stream-view-content">
            {canRenderStage && MediaStage ? (
              <MediaStage
                layout={layout}
                participants={participants}
                activeSpeakerIds={activeSpeakerIds}
                connectionState={connectionState}
                nativeHandle={nativeHandle}
              />
            ) : (
              <div className="ct-voice-channel__stream-fallback">
                {connectionState === 'connected' ? 'Voice-Provider wird initialisiert...' : 'Verbinde...'}
              </div>
            )}
          </div>

          <div className="ct-voice-channel__stream-overlay">
            <div className={`ct-voice-channel__live-tag ct-voice-channel__live-tag--${streamStatusVariant}`}>
              {streamingActive ? <Play size={12} /> : streamPaused ? <Pause size={12} /> : <Square size={12} />}
              <span>{streamLabel}</span>
            </div>
            <div className="ct-voice-channel__streamer-pill">
              <div className="ct-voice-channel__streamer-avatar">
                {(localParticipant?.name || channelName || 'S').slice(0, 1).toUpperCase()}
              </div>
              <div className="ct-voice-channel__streamer-meta">
                <span className="ct-voice-channel__streamer-name">{localParticipant?.name || channelName || 'Unbekannt'}</span>
                <span className="ct-voice-channel__streamer-status">{streamDetail}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="ct-voice-channel__stream-error">
              <XCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="ct-voice-channel__stream-gallery">
          {galleryParticipants.map((p) => {
            const isSpeaking = activeSpeakerIds.includes(p.id);
            const hasMedia = p.isScreenShareEnabled || p.isCameraEnabled;

            return (
              <div
                key={p.id}
                className={`ct-voice-channel__stream-thumb ${isSpeaking ? 'ct-voice-channel__stream-thumb--active' : ''} ${hasMedia ? 'ct-voice-channel__stream-thumb--live' : ''} ${p.id === 'placeholder' ? 'ct-voice-channel__stream-thumb--placeholder' : ''}`}
              >
                <div className="ct-voice-channel__thumb-avatar">
                  {(p.name || 'Gast').slice(0, 1).toUpperCase()}
                </div>
                <div className="ct-voice-channel__thumb-info">
                  <div className="ct-voice-channel__thumb-name">
                    <span>{p.name || 'Gast'}</span>
                    {p.isLocal && <span className="ct-voice-channel__thumb-chip">Du</span>}
                  </div>
                  <div className="ct-voice-channel__thumb-meta">
                    {p.isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                    {p.isCameraEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                    {p.isScreenShareEnabled && <Monitor size={14} />}
                  </div>
                </div>
                {hasMedia && <div className="ct-voice-channel__thumb-live-dot" />}
              </div>
            );
          })}
        </div>

        <div className="ct-voice-channel__panel">
          <div className="ct-voice-channel__panel-left">
            <div className="ct-voice-channel__panel-info">
              <div className="ct-voice-channel__panel-title">{channelName || 'Voice Stream'}</div>
              <div className="ct-voice-channel__panel-sub">{participantCountLabel} • {connectionState === 'connected' ? 'Verbunden' : 'Getrennt'} • {streamDetail}</div>
            </div>
            <div className="ct-voice-channel__panel-actions">
              <button
                onClick={handleStartStream}
                disabled={streamAction === 'start' || !canStartStream}
                className={`ct-voice-channel__control-button ${streamingActive ? 'ct-voice-channel__control-button--active' : ''}`}
              >
                <Play size={16} /> {streamPaused ? 'Fortsetzen' : 'Stream starten'}
              </button>
              <button
                onClick={handlePauseStream}
                disabled={streamAction === 'pause' || streamState === 'idle'}
                className={`ct-voice-channel__control-button ${streamPaused ? 'ct-voice-channel__control-button--warning' : ''}`}
              >
                <Pause size={16} /> Pause
              </button>
              <button
                onClick={handleStopStream}
                disabled={streamAction === 'stop' || streamState === 'idle'}
                className="ct-voice-channel__control-button ct-voice-channel__control-button--danger"
              >
                <Square size={16} /> Stop
              </button>
            </div>
          </div>

          <div className="ct-voice-channel__panel-right">
            <div className="ct-voice-channel__panel-group">
              <div className="ct-voice-channel__control-with-menu">
                <button
                  className={`ct-voice-channel__control-button ${!micMuted ? 'ct-voice-channel__control-button--active' : 'ct-voice-channel__control-button--muted'}`}
                  onClick={() => setMicMuted(!micMuted)}
                >
                  {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <ContextMenu
                  open={menuOpen === 'mic'}
                  onOpenChange={(open) => setMenuOpen(open ? 'mic' : null)}
                >
                  <ContextMenuTrigger>
                    <button className="ct-voice-channel__control-button" type="button">
                      <ChevronUp size={14} />
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="absolute bottom-[115%] left-0 w-64 bg-surface border border-border rounded-2xl shadow-glass p-1.5 z-50 text-text animate-in slide-in-from-bottom-2 duration-150">
                    <Menu className="flex flex-col gap-1" aria-label="Eingabegeräte">
                      <div className="text-[10px] uppercase font-bold text-text-muted px-3 py-2">Eingabe</div>
                      {devices.audio.map((d) => (
                        <MenuItem
                          key={d.deviceId}
                          onClick={() => handleDeviceSwitch('audio', d.deviceId)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 rounded-xl flex justify-between items-center text-text transition-colors"
                        >
                          <span className="truncate">{d.label || 'Mikrofon'}</span>
                          {settings.devices.audioInputId === d.deviceId && <Check size={14} className="text-accent" />}
                        </MenuItem>
                      ))}
                    </Menu>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
              <button
                className={`ct-voice-channel__control-button ${!muted ? 'ct-voice-channel__control-button--active' : 'ct-voice-channel__control-button--muted'}`}
                onClick={() => setMuted(!muted)}
              >
                <Headphones size={16} />
              </button>
            </div>

            <div className="ct-voice-channel__panel-group">
              <button
                className={`ct-voice-channel__control-button ${isCameraEnabled ? 'ct-voice-channel__control-button--active' : ''}`}
                onClick={toggleCamera}
              >
                {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
              <button
                className={`ct-voice-channel__control-button ${isScreenSharing ? 'ct-voice-channel__control-button--active' : ''}`}
                onClick={() => isScreenSharing ? stopScreenShare() : toggleScreenShare()}
              >
                <Monitor size={16} />
              </button>
            </div>

            <div className="ct-voice-channel__panel-group">
              <button className="ct-voice-channel__control-button" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
              <button className="ct-voice-channel__control-button" onClick={handleOpenExternal}>
                <ExternalLink size={16} />
              </button>
              <button className="ct-voice-channel__control-button ct-voice-channel__control-button--danger" onClick={handleDisconnect}>
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
