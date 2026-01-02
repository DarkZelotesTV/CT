import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ServerRail } from './ServerRail';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { TitleBar } from '../window/TitleBar';
import { TopBarProvider } from '../window/TopBarContext';
import './MainLayout.css';

// Web & Voice Views
import { WebChannelView } from '../server/WebChannelView';
import { HomeOnboardingStage } from '../dashboard/HomeOnboardingStage';
import { VoiceChannelView, VoicePreJoin } from '../../features/voice/ui';

// Modals
import { OnboardingModal } from '../modals/OnboardingModal';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';
import { CreateServerModal } from '../modals/CreateServerModal';
import { JoinServerModal } from '../modals/JoinServerModal';
import { CommandPalette } from '../modals/CommandPalette';
import { UserSettingsModal } from '../modals/UserSettingsModal';

import { useVoice, type VoiceContextType } from '../../features/voice';
import { useOnboardingReplay, type OnboardingReplayKey } from '../../features/onboarding/useOnboardingReplay';
import { storage } from '../../shared/config/storage';
import { defaultHotkeySettings, useSettings } from '../../context/SettingsContext';
import { applyAppTheme, buildAppTheme } from '../../theme/appTheme';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';
import { useLogStore } from '../../store/useLogStore';
import { useSocket } from '../../context/SocketContext';
import { resolveServerAssetUrl } from '../../utils/assetUrl';

// Standardbreiten angepasst an das Design (Tree: 280px, Info: 300px)
const defaultChannelWidth = 280;
const defaultMemberWidth = 300;
const minSidebarWidth = 200;
const maxSidebarWidth = 420;

const MOBILE_BREAKPOINT = 1024;

const focusableSelectors =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.tabIndex !== -1
  );

const normalizeHotkey = (value: string | null | undefined) => value?.replace(/\s+/g, '').toLowerCase() ?? null;

const parseHotkey = (value: string | null | undefined) => {
  const normalized = normalizeHotkey(value);
  if (!normalized) return null;

  const parts = normalized.split('+');
  const modifiers = new Set<string>();
  let key: string | null = null;

  parts.forEach((part) => {
    if (part === 'ctrl' || part === 'control' || part === 'cmd' || part === 'meta') {
      modifiers.add('ctrl');
      return;
    }
    if (part === 'alt' || part === 'option') {
      modifiers.add('alt');
      return;
    }
    if (part === 'shift') {
      modifiers.add('shift');
      return;
    }
    key = part;
  });

  if (!key) return null;
  return { key, modifiers };
};

const eventMatchesHotkey = (event: KeyboardEvent, hotkey: string | null | undefined) => {
  const parsed = parseHotkey(hotkey);
  if (!parsed) return false;

  const eventKey = event.key.toLowerCase();
  const eventModifiers = new Set<string>();
  if (event.ctrlKey || event.metaKey) eventModifiers.add('ctrl');
  if (event.altKey) eventModifiers.add('alt');
  if (event.shiftKey) eventModifiers.add('shift');

  if (eventKey !== parsed.key) return false;
  if (eventModifiers.size !== parsed.modifiers.size) return false;
  for (const mod of parsed.modifiers) {
    if (!eventModifiers.has(mod)) return false;
  }
  return true;
};

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
}

const onboardingStepIndex: Record<OnboardingReplayKey, number> = {
  identity: 0,
  servers: 1,
  voice: 2,
  settings: 3,
};

export const MainLayout = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  
  // UI State
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    if (showMobileNav) return;

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;

    const navContainers = [leftSidebarRef.current, railRef.current];
    if (navContainers.some((node) => node && node.contains(active))) {
      active.blur();
      mobileNavButtonRef.current?.focus({ preventScroll: true });
    }
  }, [showMobileNav]);


  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const isMobileLayout = containerWidth < MOBILE_BREAKPOINT;
  
  // Resizable Widths (Desktop)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => storage.get('layoutLeftWidth') ?? defaultChannelWidth);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => storage.get('layoutRightWidth') ?? defaultMemberWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showLogPanel, setShowLogPanel] = useState(true);
  const [logInput, setLogInput] = useState('');
  
  // Logic Refs
  const railRef = useRef<HTMLDivElement>(null);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mobileNavButtonRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const logBodyRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastSocketConnectedRef = useRef<boolean | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;
  
  // App Data State
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverName, setServerName] = useState<string>('');
  const [serverIcon, setServerIcon] = useState<string | null>(null);
  const [titlebarHeight, setTitlebarHeight] = useState<number>(48);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [fallbackChannel, setFallbackChannel] = useState<Channel | null>(null);
  
  // Modals & Popups
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const [onboardingConfig, setOnboardingConfig] = useState<{
    initialStep?: number;
    replayKey?: OnboardingReplayKey | null;
    action?: (() => void) | null;
  } | null>(null);
  const onboardingActionExecuted = useRef(false);
  const { shouldShowReplay, markReplaySeen } = useOnboardingReplay();
  
  const [lastNonVoiceChannel, setLastNonVoiceChannel] = useState<Channel | null>(null);
  const [pendingVoiceChannelId, setPendingVoiceChannelId] = useState<number | null>(null);
  const [serverRefreshKey, setServerRefreshKey] = useState(0);
  const { entries: logEntries, filteredEntries: filteredLogEntries, addEntry: addLogEntry, clear: clearLogEntries, filter: logFilter, setFilter: setLogFilter } = useLogStore();

  // Voice Context
  const {
    activeChannelId: connectedVoiceChannelId,
    activeChannelName: connectedVoiceChannelName,
    connectionState,
    muted,
    connectToChannel,
    providerRenderers,
    networkStats,
    connectedAt: voiceConnectedAt,
  } = useVoice();
  const lastConnectionStateRef = useRef(connectionState);
  const AudioRenderer = providerRenderers.AudioRenderer;
  const DebugOverlay = providerRenderers.DebugOverlay;
  const { isConnected: socketConnected, ping } = useSocket();

  const socketConnectedAtRef = useRef<number | null>(null);
  const [uptimeSeconds, setUptimeSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (socketConnected) {
      if (!socketConnectedAtRef.current) {
        socketConnectedAtRef.current = Date.now();
      }
    } else {
      socketConnectedAtRef.current = null;
    }
  }, [socketConnected]);

  const refreshUptime = useCallback(() => {
    const start = voiceConnectedAt ?? socketConnectedAtRef.current;
    if (!start) {
      setUptimeSeconds(null);
      return;
    }
    setUptimeSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
  }, [voiceConnectedAt]);

  useEffect(() => {
    refreshUptime();
    const interval = window.setInterval(refreshUptime, 1000);
    return () => window.clearInterval(interval);
  }, [refreshUptime]);

  useEffect(() => {
    addLogEntry({
      category: 'system',
      message: t('layout.log.sessionStart', { defaultValue: 'Client bereit' }),
    });
  }, [addLogEntry, t]);

  const activeAccent = useMemo(
    () =>
      selectedServerId
        ? settings.theme.serverAccents?.[selectedServerId] ?? settings.theme.accentColor
        : settings.theme.accentColor,
    [selectedServerId, settings.theme]
  );

  const resolvedHotkeys = useMemo(
    () => ({
      commandPalette:
        settings.hotkeys.commandPalette ?? defaultHotkeySettings.commandPalette,
      toggleMembers: settings.hotkeys.toggleMembers ?? defaultHotkeySettings.toggleMembers,
      toggleNavigation:
        settings.hotkeys.toggleNavigation ?? defaultHotkeySettings.toggleNavigation,
      skipToContent:
        settings.hotkeys.skipToContent ?? defaultHotkeySettings.skipToContent,
    }),
    [settings.hotkeys]
  );

  useEffect(() => {
    const theme = buildAppTheme(settings.theme.mode, activeAccent);
    applyAppTheme(theme);
  }, [activeAccent, settings.theme.mode]);

  const resolvedServerIcon = useMemo(
    () => (serverIcon ? resolveServerAssetUrl(serverIcon) : null),
    [serverIcon]
  );

  const uptimeDisplay = useMemo(() => {
    if (uptimeSeconds === null) return '00:00';
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (uptimeSeconds % 60).toString().padStart(2, '0');
    if (hours > 0) return `${hours}:${minutes}:${seconds}`;
    return `${minutes}:${seconds}`;
  }, [uptimeSeconds]);

  const lossValue = useMemo(() => {
    if (typeof networkStats?.packetLossPercent === 'number') {
      return Math.max(0, networkStats.packetLossPercent);
    }
    return null;
  }, [networkStats?.packetLossPercent]);

  const lossDisplay = useMemo(() => {
    if (lossValue === null) return '0%';
    return `${lossValue >= 10 ? Math.round(lossValue) : lossValue.toFixed(1)}%`;
  }, [lossValue]);

  const lossTone = useMemo(() => {
    if (lossValue === null) return 'text-white';
    if (lossValue < 1) return 'text-emerald-300';
    if (lossValue < 3) return 'text-amber-200';
    return 'text-rose-300';
  }, [lossValue]);

  const pingDisplay = useMemo(() => {
    const derived = ping ?? (networkStats?.rttMs != null ? Math.round(networkStats.rttMs) : null);
    return derived ?? 24;
  }, [networkStats?.rttMs, ping]);

  const openOnboardingModal = useCallback(
    (config?: { initialStep?: number; replayKey?: OnboardingReplayKey | null; action?: (() => void) | null }) => {
      onboardingActionExecuted.current = false;
      setOnboardingConfig({
        initialStep: config?.initialStep ?? 0,
        replayKey: config?.replayKey ?? null,
        action: config?.action ?? null,
      });
      setShowOnboarding(true);
    },
    []
  );

  const resolveOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (onboardingConfig?.replayKey) {
      markReplaySeen(onboardingConfig.replayKey);
    }

    if (!onboardingActionExecuted.current) {
      onboardingConfig?.action?.();
    }

    onboardingActionExecuted.current = false;
    setOnboardingConfig(null);
  }, [markReplaySeen, onboardingConfig]);

  const ensureOnboardingForStep = useCallback(
    (stepKey: OnboardingReplayKey, action: () => void) => {
      if (storage.get('onboardingDone') && shouldShowReplay(stepKey)) {
        openOnboardingModal({ initialStep: onboardingStepIndex[stepKey], replayKey: stepKey, action });
        return true;
      }
      return false;
    },
    [openOnboardingModal, shouldShowReplay]
  );

  const focusContainer = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      const first = focusable[0];
      if (first) {
        first.focus();
        return;
      }
      return;
    }
    container.focus({ preventScroll: true });
  }, []);

  const focusMainContent = useCallback(() => {
    if (!mainContentRef.current) return;
    mainContentRef.current.focus({ preventScroll: false });
  }, []);

  const recordPreviousFocus = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      previousFocusRef.current = active;
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (typeof window === 'undefined') return;
      if (!touchStartRef.current) return;
      if (window.innerWidth >= MOBILE_BREAKPOINT) return;

      const touch = event.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const isHorizontalSwipe = absX > absY && absX > 50;
      const isVerticalSwipe = absY > absX && absY > 50;

      if (isHorizontalSwipe) {
        if (deltaX > 0 && !showMobileNav && touchStartRef.current.x < 60) {
          setShowMobileNav(true);
        } else if (deltaX < 0 && showMobileNav) {
          setShowMobileNav(false);
        }
      } else if (isVerticalSwipe && selectedServerId) {
        const viewportHeight = window.innerHeight;
        if (deltaY < 0 && !showRightSidebar && touchStartRef.current.y > viewportHeight - 160) {
          setShowRightSidebar(true);
        } else if (deltaY > 0 && showRightSidebar) {
          setShowRightSidebar(false);
        }
      }

      touchStartRef.current = null;
    },
    [selectedServerId, showMobileNav, showRightSidebar]
  );

  const computedMaxSidebarWidth = useMemo(() => {
    if (!containerWidth) return maxSidebarWidth;
    const dynamicMax = Math.floor(containerWidth * 0.4);
    return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, dynamicMax));
  }, [containerWidth]);

  const clampSidebarWidth = useCallback(
    (value: number) => Math.min(Math.max(value, minSidebarWidth), computedMaxSidebarWidth),
    [computedMaxSidebarWidth]
  );

  const effectiveLeftSidebarWidth = useMemo(
    () => clampSidebarWidth(leftSidebarWidth ?? defaultChannelWidth),
    [clampSidebarWidth, leftSidebarWidth]
  );

  const effectiveRightSidebarWidth = useMemo(
    () => clampSidebarWidth(rightSidebarWidth ?? defaultMemberWidth),
    [clampSidebarWidth, rightSidebarWidth]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLeft = storage.get('layoutLeftWidth') ?? defaultChannelWidth;
    setLeftSidebarWidth(clampSidebarWidth(storedLeft));

    const storedRight = storage.get('layoutRightWidth') ?? defaultMemberWidth;
    setRightSidebarWidth(clampSidebarWidth(storedRight));
  }, [clampSidebarWidth]);

  useEffect(() => {
    storage.set('layoutLeftWidth', clampSidebarWidth(leftSidebarWidth));
  }, [clampSidebarWidth, leftSidebarWidth]);

  useEffect(() => {
    storage.set('layoutRightWidth', clampSidebarWidth(rightSidebarWidth));
  }, [clampSidebarWidth, rightSidebarWidth]);

  useEffect(() => {
    if (!layoutRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isMobileLayout) {
      setShowRightSidebar(false);
      setShowLogPanel(false);
    } else {
      setShowLogPanel(true);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
        setShowMobileNav(false);
    }
  }, [activeChannel?.id]);

  useEffect(() => {
    if (!activeChannel && fallbackChannel) {
      setActiveChannel(fallbackChannel);
      if (fallbackChannel.type !== 'voice') {
        setPendingVoiceChannelId(null);
        setLastNonVoiceChannel(fallbackChannel);
      }
    }
  }, [activeChannel, fallbackChannel]);

  const previousConnectionState = useRef<VoiceContextType['connectionState'] | null>(null);
  useEffect(() => {
    const prev = previousConnectionState.current;
    if (prev && prev !== 'disconnected' && connectionState === 'disconnected' && activeChannel?.type === 'voice') {
      if (fallbackChannel) setActiveChannel(fallbackChannel);
    }
    previousConnectionState.current = connectionState;
  }, [activeChannel, connectionState, fallbackChannel]);

  useEffect(() => {
    if (
      connectedVoiceChannelId &&
      pendingVoiceChannelId &&
      connectedVoiceChannelId === pendingVoiceChannelId &&
      connectionState === 'connected'
    ) {
      setPendingVoiceChannelId(null);
    }
  }, [connectedVoiceChannelId, connectionState, pendingVoiceChannelId]);

  useEffect(() => {
    if (!storage.get('onboardingDone')) {
      openOnboardingModal({ initialStep: 0, replayKey: null, action: null });
    }
  }, [openOnboardingModal]);

  useEffect(() => {
    const pending = storage.get('pendingServerId');
    if (pending) {
      setSelectedServerId(pending);
      storage.remove('pendingServerId');
    }
  }, []);

  useEffect(() => {
    const handleGlobalHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (eventMatchesHotkey(event, resolvedHotkeys.commandPalette)) {
        event.preventDefault();
        recordPreviousFocus();
        setShowCommandPalette(true);
        return;
      }
    };
    document.addEventListener('keydown', handleGlobalHotkeys);
    return () => document.removeEventListener('keydown', handleGlobalHotkeys);
  }, [focusMainContent, recordPreviousFocus, resolvedHotkeys, selectedServerId]);

  const handleServerSelect = useCallback((id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setFallbackChannel(null);
    setShowServerSettings(false);
    setServerIcon(null);
    if (id) {
      addLogEntry({
        category: 'system',
        message: t('layout.log.serverSelected', { defaultValue: 'Server gewechselt', server: id }) || `Server #${id} ausgewählt`,
      });
    }
  }, [addLogEntry, t]);

  const handleChannelSelect = useCallback((channel: Channel) => {
    setActiveChannel(channel);
    if (channel.type === 'voice') {
      setPendingVoiceChannelId(channel.id);
      addLogEntry({
        category: 'voice',
        message: t('layout.log.voiceTarget', { defaultValue: 'Voice-Kanal anvisiert', channel: channel.name }) ?? `Voice: ${channel.name}`,
      });
    } else {
      setPendingVoiceChannelId(null);
      setLastNonVoiceChannel(channel);
      addLogEntry({
        category: 'chat',
        message: t('layout.log.channelSelected', { defaultValue: 'Kanal geöffnet', channel: channel.name }) ?? `Kanal: ${channel.name}`,
      });
    }
    setShowMobileNav(false); 
  }, [addLogEntry, t]);

  const handleResolveFallback = useCallback((channel: Channel | null) => {
    setFallbackChannel((prev) => (prev?.id === channel?.id ? prev : channel));
  }, []);

  const handleVoiceJoin = useCallback(async (channel: Channel) => {
      await connectToChannel(channel.id, channel.name);
    }, [connectToChannel]);

  const attemptVoiceJoin = useCallback(
    (channel: Channel) => {
      if (ensureOnboardingForStep('voice', () => handleVoiceJoin(channel))) return;
      handleVoiceJoin(channel);
    },
    [ensureOnboardingForStep, handleVoiceJoin]
  );

  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'voice') return;
    if (settings.talk.showVoicePreJoin !== false) return;

    const isConnectedToTarget = connectedVoiceChannelId === activeChannel.id && connectionState === 'connected';
    const isJoiningTarget =
      pendingVoiceChannelId === activeChannel.id &&
      (connectionState === 'connecting' || connectionState === 'reconnecting');

    if (!isConnectedToTarget && !isJoiningTarget) {
      attemptVoiceJoin(activeChannel);
    }
  }, [activeChannel, attemptVoiceJoin, connectedVoiceChannelId, connectionState, pendingVoiceChannelId, settings.talk.showVoicePreJoin]);

  const handleVoiceCancel = useCallback(() => {
    setPendingVoiceChannelId(null);
    if (connectedVoiceChannelId && connectedVoiceChannelName) {
      setActiveChannel({ id: connectedVoiceChannelId, name: connectedVoiceChannelName, type: 'voice' });
      return;
    }
    if (lastNonVoiceChannel) {
      setActiveChannel(lastNonVoiceChannel);
      return;
    }
    if (fallbackChannel) {
      setActiveChannel(fallbackChannel);
      return;
    }
    setActiveChannel(null);
  }, [connectedVoiceChannelId, connectedVoiceChannelName, fallbackChannel, lastNonVoiceChannel]);

  useEffect(() => {
    if (lastConnectionStateRef.current === connectionState) return;
    lastConnectionStateRef.current = connectionState;
    if (connectionState === 'connected') {
      addLogEntry({
        category: 'voice',
        message: t('layout.log.voiceConnected', { defaultValue: 'Voice verbunden' }),
      });
      return;
    }
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      addLogEntry({
        category: 'voice',
        message: t('layout.log.voiceConnecting', { defaultValue: 'Verbindungsaufbau…' }),
      });
      return;
    }
    addLogEntry({
      category: 'voice',
      message: t('layout.log.voiceDisconnected', { defaultValue: 'Voice getrennt' }),
    });
  }, [addLogEntry, connectionState, t]);

  useEffect(() => {
    if (lastSocketConnectedRef.current === null) {
      lastSocketConnectedRef.current = socketConnected;
      return;
    }
    if (lastSocketConnectedRef.current === socketConnected) return;
    lastSocketConnectedRef.current = socketConnected;
    addLogEntry({
      category: 'system',
      message: socketConnected
        ? t('layout.log.socketConnected', { defaultValue: 'Echtzeit verbunden' })
        : t('layout.log.socketDisconnected', { defaultValue: 'Echtzeit getrennt' }),
    });
  }, [addLogEntry, socketConnected, t]);

  const handleOnboardingStepAction = useCallback(
    (step: OnboardingReplayKey) => {
      onboardingActionExecuted.current = true;
      if (onboardingConfig?.action) {
        onboardingConfig.action();
        return;
      }
      if (step === 'servers') {
        setShowCreateServer(true);
        return;
      }
      if (step === 'voice' && activeChannel?.type === 'voice') {
        handleVoiceJoin(activeChannel);
      }
      if (step === 'settings' && selectedServerId) {
        setShowServerSettings(true);
      }
    },
    [activeChannel, handleVoiceJoin, onboardingConfig, selectedServerId]
  );

  const announceServerChange = useCallback(() => {
    window.dispatchEvent(new Event('ct-servers-changed'));
  }, []);

  const handleServerUpdated = useCallback(
    ({ fallbackChannelId }: { name: string; fallbackChannelId: number | null }) => {
      announceServerChange();
      setServerRefreshKey((value) => value + 1);
      setFallbackChannel((prev) => (prev && prev.id === fallbackChannelId ? prev : null));
      setShowServerSettings(false);
    }, [announceServerChange]
  );

  const handleServerDeleted = useCallback(() => {
    announceServerChange();
    handleServerSelect(null);
  }, [announceServerChange, handleServerSelect]);

  const handleCreateServer = useCallback(() => {
    if (ensureOnboardingForStep('servers', () => setShowCreateServer(true))) return;
    setShowCreateServer(true);
  }, [ensureOnboardingForStep]);

  const handleJoinServer = useCallback(() => {
    if (ensureOnboardingForStep('servers', () => setShowJoinServer(true))) return;
    setShowJoinServer(true);
  }, [ensureOnboardingForStep]);

  const handleOpenServerSettings = useCallback(() => {
    if (!selectedServerId) return;
    if (ensureOnboardingForStep('settings', () => setShowServerSettings(true))) return;
    setShowServerSettings(true);
  }, [ensureOnboardingForStep, selectedServerId]);

  const handleShowMembers = useCallback(() => {
    if (!selectedServerId) return;
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
      setShowRightSidebar(true);
      return;
    }
    setShowRightSidebar(true);
  }, [selectedServerId]);

  const handleNotificationNavigate = useCallback(
    (target: { serverId?: number; channelId?: number; channelName?: string; channelType?: Channel['type'] }) => {
      if (typeof target.serverId === 'number') {
        handleServerSelect(target.serverId);
      }
      if (target.channelId && target.channelName && target.channelType) {
        handleChannelSelect({ id: target.channelId, name: target.channelName, type: target.channelType });
      }
      setShowMobileNav(false);
      focusMainContent();
    },
    [focusMainContent, handleChannelSelect, handleServerSelect]
  );

  useDesktopNotifications(handleNotificationNavigate);

  // --- Dragging Handlers ---
  const startDragLeft = (event: React.MouseEvent) => {
    setIsDraggingLeft(true);
    dragState.current = { startX: event.clientX, startWidth: leftSidebarWidth };
  };

  const startDragRight = (event: React.MouseEvent) => {
    setIsDraggingRight(true);
    dragState.current = { startX: event.clientX, startWidth: rightSidebarWidth };
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingLeft) {
        const delta = event.clientX - dragState.current.startX;
        setLeftSidebarWidth(clampSidebarWidth(dragState.current.startWidth + delta));
      }
      if (isDraggingRight) {
        const delta = event.clientX - dragState.current.startX;
        setRightSidebarWidth(clampSidebarWidth(dragState.current.startWidth - delta));
      }
    };
    const stopDragging = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };
    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDragging);
      document.body.classList.add('select-none');
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      document.body.classList.remove('select-none');
    };
  }, [isDraggingLeft, isDraggingRight, clampSidebarWidth]);

  // --- Render Content Logic ---
  const renderContent = () => {
    if (!selectedServerId) {
      return (
        <div className="flex-1 relative h-full">
          <HomeOnboardingStage
            onCreateServer={handleCreateServer}
            onJoinServer={handleJoinServer}
          />
        </div>
      );
    }
    if (activeChannel?.type === 'web') {
      return <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
    }
    if (activeChannel?.type === 'text') {
      return (
        <div className="flex-1 flex items-center justify-center relative h-full">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="text-center p-10 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-2">{t('layout.textChannelSelected')}</h2>
            <p className="text-gray-500 text-sm max-w-md">{t('layout.textChannelUnsupported')}</p>
          </div>
        </div>
      );
    }
    if (activeChannel?.type === 'voice') {
      const isConnectedToTarget = connectedVoiceChannelId === activeChannel.id && connectionState === 'connected';
      const showVoicePreJoin = settings.talk.showVoicePreJoin !== false;
      const isJoiningTarget =
        pendingVoiceChannelId === activeChannel.id &&
        (connectionState === 'connecting' || connectionState === 'reconnecting');

      if (isConnectedToTarget || !showVoicePreJoin) {
        return <VoiceChannelView channelName={activeChannel.name} />;
      }
      return (
        <VoicePreJoin
          channel={activeChannel}
          onJoin={() => attemptVoiceJoin(activeChannel)}
          onCancel={handleVoiceCancel}
          isJoining={isJoiningTarget}
          connectedChannelName={connectedVoiceChannelName}
          connectedElsewhere={connectedVoiceChannelId !== null && connectedVoiceChannelId !== activeChannel.id && connectionState !== 'disconnected'}
        />
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center relative h-full">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="text-center p-12 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-2">{t('layout.stageAreaTitle')}</h2>
          <p className="text-gray-500 text-sm">{t('layout.stageAreaDescription')}</p>
        </div>
      </div>
    );
  };

  const logTabs: { id: 'all' | 'system' | 'voice' | 'chat'; label: string; count: number }[] = useMemo(() => {
    const counts = logEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { id: 'all', label: t('layout.log.tabs.all', { defaultValue: 'System Log' }), count: logEntries.length },
      { id: 'chat', label: t('layout.log.tabs.chat', { defaultValue: 'Chat' }), count: counts.chat ?? 0 },
    ];
  }, [logEntries, t]);

  const formatLogTime = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleTimeString('de-DE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    []
  );

  const handleLogCommand = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = logInput.trim();
      if (!value) return;

      const [prefix, ...rest] = value.split(' ');
      let category: 'system' | 'voice' | 'chat' = 'system';
      let message = value;

      if (prefix === '/voice') {
        category = 'voice';
        message = rest.join(' ') || t('layout.log.cmd.voice', { defaultValue: 'Voice-Kommando' });
      } else if (prefix === '/chat') {
        category = 'chat';
        message = rest.join(' ') || t('layout.log.cmd.chat', { defaultValue: 'Chat-Kommando' });
      }

      addLogEntry({ category, message });
      setLogInput('');
    },
    [addLogEntry, logInput, t]
  );

  useEffect(() => {
    if (!logBodyRef.current) return;
    logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
  }, [filteredLogEntries, showLogPanel]);

  const layoutClassName = classNames('main-layout', {
    'fold-tree': !showLeftSidebar && !isMobileLayout,
    'fold-info': !showRightSidebar && !isMobileLayout,
    'fold-log': !showLogPanel && !isMobileLayout,
    'mobile-nav-open': showMobileNav,
  });

  // Dynamische CSS Variablen für Grid-Spalten
  const gridStyle = {
    '--curr-tree': isMobileLayout
      ? showMobileNav
        ? 'var(--mobile-tree-width, min(80vw, 320px))'
        : '0px'
      : showLeftSidebar
      ? `${effectiveLeftSidebarWidth}px`
      : '0px',
    '--curr-info': isMobileLayout ? '0px' : showRightSidebar ? `${effectiveRightSidebarWidth}px` : '0px',
    '--curr-log': showLogPanel ? 'var(--h-log, 160px)' : '36px',
  } as React.CSSProperties;

  const ui = (
    <TopBarProvider>
      {/* HIER beginnt die angepasste Struktur basierend auf der index.html
        Die Klassen (rail-panel, header-panel etc.) matchen die neuen CSS-Stile.
      */}
      <div className={layoutClassName} style={isDesktop ? { ...gridStyle, paddingTop: titlebarHeight } : gridStyle}>
        
        {/* ORBS */}
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>

        <a
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            focusMainContent();
          }}
          className="skip-link"
        >
          {t('layout.skipToContent', { defaultValue: 'Skip to content' })}
        </a>

        {isDesktop && (
          <TitleBar
            serverName={serverName}
            serverIcon={serverIcon}
            channel={activeChannel}
            onOpenServerSettings={handleOpenServerSettings}
            onOpenUserSettings={() => setShowUserSettings(true)}
          />
        )}

        {/* --- GLOBAL MODALS (bleiben erhalten) --- */}
        {showOnboarding && (
          <OnboardingModal
            onClose={resolveOnboarding}
            initialStep={onboardingConfig?.initialStep ?? 0}
            onStepAction={handleOnboardingStepAction}
          />
        )}
        {showCreateServer && (
          <CreateServerModal
            onClose={() => setShowCreateServer(false)}
            onCreated={() => {
              announceServerChange();
              setShowCreateServer(false);
            }}
          />
        )}
        {showJoinServer && (
          <JoinServerModal
            onClose={() => setShowJoinServer(false)}
            onJoined={() => {
              announceServerChange();
              setShowJoinServer(false);
            }}
          />
        )}
        {showUserSettings && <UserSettingsModal onClose={() => setShowUserSettings(false)} />}

        {selectedServerId && showServerSettings && (
          <ServerSettingsModal
            serverId={selectedServerId}
            onClose={() => setShowServerSettings(false)}
            onUpdated={handleServerUpdated}
            onDeleted={handleServerDeleted}
          />
        )}
        <CommandPalette
          open={showCommandPalette}
          serverId={selectedServerId}
          serverName={serverName}
          onClose={() => setShowCommandPalette(false)}
          onSelectServer={(id) => {
            handleServerSelect(id);
            setShowCommandPalette(false);
          }}
          onSelectChannel={(channel) => {
            handleChannelSelect(channel);
            setShowCommandPalette(false);
          }}
          onShowMembers={() => {
            handleShowMembers();
            setShowCommandPalette(false);
          }}
          onCreateServer={() => {
            handleCreateServer();
            setShowCommandPalette(false);
          }}
          onJoinServer={() => {
            handleJoinServer();
            setShowCommandPalette(false);
          }}
          onOpenServerSettings={() => {
            handleOpenServerSettings();
            setShowCommandPalette(false);
          }}
        />

        <div className="mobile-overlay" onClick={() => setShowMobileNav(false)} />

        {/* --- 1. RAIL (Links außen) --- */}
        <nav
          ref={railRef}
          className="rail-panel no-drag"
          role={isMobileLayout ? 'dialog' : 'complementary'}
          aria-modal={isMobileLayout && showMobileNav}
          aria-hidden={isMobileLayout ? !showMobileNav : false}
        >
          <ServerRail
            selectedServerId={selectedServerId}
            onSelectServer={handleServerSelect}
            onCreateServer={handleCreateServer}
            onJoinServer={handleJoinServer}
          />
        </nav>

        {/* --- 2. HEADER (Oben) --- */}
        <header className="header-panel drag">
          {/* Linker Bereich: Pfad / Icon */}
          <div className="h-path no-drag flex items-center gap-3">
             {isMobileLayout && (
                <button
                  className="icon-button mr-2"
                  onClick={() => setShowMobileNav(true)}
                  ref={mobileNavButtonRef}
                >
                  <Menu size={18} />
                </button>
              )}
            {resolvedServerIcon ? (
              <img
                src={resolvedServerIcon}
                className="h-server-icon w-7 h-7 rounded-lg object-cover shadow-[0_0_20px_rgba(16,185,129,0.35)] border border-emerald-500/30"
                alt={serverName || 'Server'}
              />
            ) : (
              <div className="h-server-icon w-7 h-7 rounded-lg bg-gray-700/50 border border-white/10" />
            )}
            <div className="flex flex-col leading-tight">
              <span className="text-[0.95rem] font-bold text-white tracking-wide drop-shadow-sm">
                {serverName || 'ZIMPLY'}
              </span>
            </div>
          </div>
          
          {/* Mittlerer Bereich: Telemetry Bar (Neu) */}
          <div className="telemetry-bar no-drag hidden md:flex gap-3">
            <div className="t-item">
              <span className="t-label">PING</span>
              <span className="t-val text-emerald-200">{pingDisplay}ms</span>
            </div>
            <div className="t-item">
              <span className="t-label">LOSS</span>
              <span className={classNames('t-val', lossTone)}>{lossDisplay}</span>
            </div>
            <div className="t-item">
              <span className="t-label">UPTIME</span>
              <span className="t-val text-white" id="time">
                {uptimeDisplay}
              </span>
            </div>
          </div>

          {/* Rechter Bereich: Actions */}
          <div className="flex items-center gap-2 no-drag">
            {selectedServerId && (
              <>
                 <button 
                    className={classNames("pill", {active: showLogPanel})}
                    onClick={() => setShowLogPanel(!showLogPanel)}
                    title={showLogPanel ? t('layout.hideLog') : t('layout.showLog')}
                 >
                    <ChevronDown size={14} className={showLogPanel ? "" : "rotate-180"} />
                 </button>
                 <button 
                    className={classNames("pill", {active: showRightSidebar})}
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    title={showRightSidebar ? t('layout.hideMembers') : t('layout.showMembers')}
                 >
                    <Users size={14} />
                 </button>
              </>
            )}
          </div>
        </header>

        {/* --- 3. TREE (Channels Links) --- */}
        {selectedServerId && (
          <aside
            ref={leftSidebarRef}
            className="tree-panel no-drag relative"
            aria-hidden={isMobileLayout ? !showMobileNav : !showLeftSidebar}
          >
            <div className="tree-content custom-scrollbar flex-1 overflow-hidden">
              <ChannelSidebar
                serverId={selectedServerId}
                activeChannelId={activeChannel?.id || null}
                onSelectChannel={handleChannelSelect}
                onServerNameChange={(name) => setServerName(name)}
                onServerIconChange={(icon) => setServerIcon(icon)}
                onOpenServerSettings={() => {
                  handleOpenServerSettings();
                  setShowMobileNav(false);
                }}
                onOpenUserSettings={() => setShowUserSettings(true)}
                onCloseMobileNav={() => setShowMobileNav(false)}
                onResolveFallback={handleResolveFallback}
                refreshKey={serverRefreshKey}
              />
              {!isMobileLayout && showLeftSidebar && <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-20 hover:bg-white/10" onMouseDown={startDragLeft} />}
            </div>
          </aside>
        )}

        {/* --- 4. MAIN STAGE (Mitte) --- */}
        <main ref={mainContentRef} id="main-content" tabIndex={-1} className="main-panel no-drag relative overflow-hidden flex flex-col">
          {!isMobileLayout && (
            <>
              <button
                type="button"
                className="edge-toggle edge-left"
                onClick={() => setShowLeftSidebar((prev) => !prev)}
                aria-label={showLeftSidebar ? t('layout.hideChannels', { defaultValue: 'Kanäle ausblenden' }) : t('layout.showChannels', { defaultValue: 'Kanäle einblenden' })}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="edge-toggle edge-right"
                onClick={() => setShowRightSidebar((prev) => !prev)}
                aria-label={showRightSidebar ? t('layout.hideMembers', { defaultValue: 'Mitglieder ausblenden' }) : t('layout.showMembers', { defaultValue: 'Mitglieder einblenden' })}
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
           {/* Mobile Toggle Row falls nötig, oder via Header gelöst */}
          <div className="main-content flex-1 min-h-0 relative">
              {renderContent()}
          </div>
        </main>

        {/* --- 5. INFO (Members Rechts) --- */}
        {selectedServerId && (
          <aside
            ref={rightSidebarRef}
            className="info-panel no-drag relative"
            style={{ display: isMobileLayout && !showRightSidebar ? 'none' : undefined }}
            aria-hidden={!showRightSidebar && !isMobileLayout}
          >
            <div className="info-content custom-scrollbar h-full overflow-y-auto">
              <MemberSidebar serverId={selectedServerId} />
              {!isMobileLayout && showRightSidebar && <div className="absolute top-0 left-0 w-1 h-full cursor-col-resize z-20 hover:bg-white/10" onMouseDown={startDragRight} />}
            </div>
          </aside>
        )}

        {/* --- 6. LOG (Unten) --- */}
        {selectedServerId && (
          <footer
            className="log-panel no-drag flex flex-col shadow-2xl z-50 backdrop-blur-xl bg-[rgba(8,8,10,0.9)] border-t border-white/5"
            style={{ display: isMobileLayout && !showLogPanel ? 'none' : undefined }}
            aria-hidden={!showLogPanel && !isMobileLayout}
          >
            {/* Log Header */}
            <div className="log-head h-9 bg-white/5 border-b border-white/5 flex items-center px-3 gap-2">
              {logTabs.map((tab) => (
                <div
                    key={tab.id}
                    className={classNames("pill", { active: logFilter === tab.id })}
                    onClick={() => setLogFilter(tab.id as any)}
                >
                    {tab.label}
                </div>
              ))}
              <div style={{flex:1}} className="drag-handle h-full" />
              <div 
                className="pill hover:bg-white/5 cursor-pointer text-xs px-4 py-1 rounded-full text-gray-400 transition-colors" 
                onClick={() => clearLogEntries()}
                title={t('layout.log.clear')}
              >
                Clear
              </div>
            </div>

            {/* Log Body */}
            {showLogPanel && (
              <>
                <div ref={logBodyRef} className="log-body flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 leading-relaxed custom-scrollbar">
                  {filteredLogEntries.length === 0 && (
                    <div className="text-gray-600 text-center py-4 italic">
                      {t('layout.log.empty', { defaultValue: 'Keine Einträge' })}
                    </div>
                  )}
                  {filteredLogEntries.map((entry) => (
                    <div key={entry.id} className="ln mb-0.5">
                      <span className="ts text-gray-600 mr-2">[{formatLogTime(entry.createdAt)}]</span>
                      <span className={classNames("font-bold mr-2", {
                          "text-emerald-400": entry.category === 'system',
                          "text-blue-400": entry.category === 'voice',
                          "text-pink-400": entry.category === 'chat'
                      })}>
                        {entry.category === 'system' ? '' : `[${entry.category.toUpperCase()}] `}
                      </span>
                      <span>{entry.message}</span>
                    </div>
                  ))}
                </div>
                {/* Log Command Input */}
                <form className="log-cmd bg-black/20 border-t border-white/5 p-2 px-4 flex items-center gap-2" onSubmit={handleLogCommand}>
                  <span className="text-emerald-500 font-bold">&gt;</span>
                  <input
                    className="bg-transparent border-none text-white w-full font-mono text-[13px] focus:outline-none placeholder-gray-600"
                    value={logInput}
                    onChange={(event) => setLogInput(event.target.value)}
                    placeholder={t('layout.log.commandPlaceholder', { defaultValue: 'Befehl eingeben...' }) ?? ''}
                  />
                </form>
              </>
            )}
          </footer>
        )}
      </div>
    </TopBarProvider>
  );

  return (
    <>
      {AudioRenderer && <AudioRenderer />}
      {DebugOverlay && <DebugOverlay />}
      {ui}
    </>
  );
};
