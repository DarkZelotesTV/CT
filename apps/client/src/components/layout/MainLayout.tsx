import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users, Menu, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ServerRail } from './ServerRail';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { TitleBar } from '../window/TitleBar';
import { TopBarProvider } from '../window/TopBarContext';
import { DecorationLayer } from './DecorationLayer';
import { SidebarResizer } from './SidebarResizer';
import './LayoutShell.css';

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
import { applyAppTheme, applyDensitySettings, buildAppTheme } from '../../theme/appTheme';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';
import { useLogStore } from '../../store/useLogStore';
import { useSocket } from '../../context/SocketContext';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import { EmptyState, Icon } from '../ui';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';

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
  const decorationsEnabled = settings.theme.decorationsEnabled ?? true;
  
  // UI State
  const [showMobileNav, setShowMobileNav] = useState(false);

  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const isMobileLayout = containerWidth < MOBILE_BREAKPOINT;
  
  // Resizable Widths (Desktop)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => storage.get('layoutLeftWidth') ?? defaultChannelWidth);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => storage.get('layoutRightWidth') ?? defaultMemberWidth);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showLogPanel, setShowLogPanel] = useState(true);
  const [logInput, setLogInput] = useState('');
  
  // Logic Refs
  const railRef = useRef<HTMLDivElement>(null);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mobileNavButtonRef = useRef<HTMLButtonElement>(null);
  const mobileInfoButtonRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const logBodyRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastOverlayFocusRef = useRef<'nav' | 'info' | null>(null);
  const previousOverlayStateRef = useRef(false);
  const lastSocketConnectedRef = useRef<boolean | null>(null);
  const scrollLockPositionRef = useRef<number | null>(null);

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
  const hasServers = useMemo(() => (storage.get('serverRailOrder') ?? []).length > 0, [serverRefreshKey]);
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
    }),
    [settings.hotkeys]
  );

  useEffect(() => {
    const theme = buildAppTheme(settings.theme.mode, activeAccent);
    applyAppTheme(theme);
    applyDensitySettings(settings.theme.density);
  }, [activeAccent, settings.theme.density, settings.theme.mode]);

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
    if (lossValue === null) return 'text-text';
    if (lossValue < 1) return 'text-[color:var(--color-text-success)]';
    if (lossValue < 3) return 'text-[color:var(--color-text-warning)]';
    return 'text-[color:var(--color-text-danger)]';
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

  useEffect(() => {
    if (!isMobileLayout) return;
    if (showMobileNav) {
      lastOverlayFocusRef.current = 'nav';
    } else if (showRightSidebar) {
      lastOverlayFocusRef.current = 'info';
    }
  }, [isMobileLayout, showMobileNav, showRightSidebar]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!showMobileNav && !showRightSidebar) return;
    recordPreviousFocus();
  }, [isMobileLayout, recordPreviousFocus, showMobileNav, showRightSidebar]);

  useEffect(() => {
    if (!isMobileLayout || !showMobileNav) return;
    if (typeof window === 'undefined') return;

    const focusNav = () => {
      const containers = [railRef.current, leftSidebarRef.current];
      for (const container of containers) {
        if (!container) continue;
        const focusable = getFocusableElements(container);
        if (focusable.length > 0) {
          focusable[0].focus({ preventScroll: true });
          return;
        }
      }
      if (railRef.current) {
        focusContainer(railRef.current);
        return;
      }
      focusContainer(leftSidebarRef.current);
    };

    const frame = window.requestAnimationFrame(focusNav);
    return () => window.cancelAnimationFrame(frame);
  }, [focusContainer, isMobileLayout, showMobileNav]);

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

  // --- Render Content Logic ---
  const renderContent = () => {
    if (!selectedServerId) {
      return (
        <div className="flex-1 relative h-full">
          <HomeOnboardingStage
            onCreateServer={handleCreateServer}
            onJoinServer={handleJoinServer}
            onOpenSettings={() => setShowUserSettings(true)}
            hasServers={hasServers}
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
          <EmptyState
            variant="glass"
            icon={<Icon icon={MessageSquare} size="lg" tone="muted" />}
            title={t('layout.textChannelSelected')}
            body={t('layout.textChannelUnsupported')}
            className="max-w-lg"
          />
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
        <EmptyState
          variant="glass"
          icon={<Icon icon={Sparkles} size="lg" tone="muted" />}
          title={t('layout.stageAreaTitle')}
          body={t('layout.stageAreaDescription')}
          className="max-w-lg"
        />
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
    'home-layout': !selectedServerId,
    'mobile-nav-open': isMobileLayout && showMobileNav,
    'mobile-info-open': isMobileLayout && showRightSidebar,
  });
  const isMobileOverlayActive = isMobileLayout && (showMobileNav || showRightSidebar);

  useEffect(() => {
    if (!isMobileOverlayActive || typeof window === 'undefined') {
      return;
    }

    const scrollY = window.scrollY;
    scrollLockPositionRef.current = scrollY;
    document.body.classList.add('mobile-scroll-lock');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    return () => {
      const restorePosition = scrollLockPositionRef.current ?? scrollY;
      scrollLockPositionRef.current = null;
      document.body.classList.remove('mobile-scroll-lock');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, restorePosition);
    };
  }, [isMobileOverlayActive]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!isMobileOverlayActive) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowMobileNav(false);
      setShowRightSidebar(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileLayout, isMobileOverlayActive]);

  useEffect(() => {
    if (!isMobileLayout) return;
    const isOpen = showMobileNav || showRightSidebar;
    const wasOpen = previousOverlayStateRef.current;
    if (wasOpen && !isOpen) {
      if (lastOverlayFocusRef.current === 'nav' && mobileNavButtonRef.current) {
        mobileNavButtonRef.current.focus({ preventScroll: true });
      } else if (lastOverlayFocusRef.current === 'info' && mobileInfoButtonRef.current) {
        mobileInfoButtonRef.current.focus({ preventScroll: true });
      } else if (previousFocusRef.current) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    }
    previousOverlayStateRef.current = isOpen;
  }, [isMobileLayout, showMobileNav, showRightSidebar]);

  // Dynamische CSS Variablen für Grid-Spalten
  const gridStyle = {
    '--curr-tree': !selectedServerId
      ? '0px'
      : isMobileLayout
      ? showMobileNav
        ? 'var(--mobile-tree-width, min(80vw, 320px))'
        : '0px'
      : showLeftSidebar
      ? `${effectiveLeftSidebarWidth}px`
      : '0px',
    '--curr-info': !selectedServerId
      ? '0px'
      : isMobileLayout
      ? showRightSidebar
        ? 'var(--mobile-info-width, min(75vw, 320px))'
        : '0px'
      : showRightSidebar
      ? `${effectiveRightSidebarWidth}px`
      : '0px',
    '--curr-log': !selectedServerId ? '0px' : showLogPanel ? 'var(--h-log, 160px)' : '36px',
  } as React.CSSProperties;

  const handleOverlayClick = useCallback(() => {
    if (!isMobileLayout) return;
    setShowMobileNav(false);
    setShowRightSidebar(false);
  }, [isMobileLayout]);

  const ui = (
    <TopBarProvider>
      {/* HIER beginnt die angepasste Struktur basierend auf der index.html
        Die Klassen (rail-panel, header-panel etc.) matchen die neuen CSS-Stile.
      */}
      <div className={layoutClassName} style={isDesktop ? { ...gridStyle, paddingTop: titlebarHeight } : gridStyle}>
        <DecorationLayer enabled={decorationsEnabled} />

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

        <div
          className="mobile-overlay"
          role="presentation"
          aria-hidden={!isMobileOverlayActive}
          onClick={handleOverlayClick}
        />

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
                <IconButton
                  className="icon-button mr-2"
                  onClick={() => setShowMobileNav(true)}
                  ref={mobileNavButtonRef}
                >
                  <Icon icon={Menu} size="md" tone="default" className="text-inherit" />
                </IconButton>
              )}
            {selectedServerId && (
              <>
                {resolvedServerIcon ? (
                  <img
                    src={resolvedServerIcon}
                    className="h-server-icon w-7 h-7 rounded-[var(--radius-2)] object-cover shadow-[0_0_20px_rgba(16,185,129,0.35)] border border-emerald-500/30"
                    alt={serverName || 'Server'}
                  />
                ) : (
                  <div className="h-server-icon w-7 h-7 rounded-[var(--radius-2)] bg-[color:var(--color-surface-hover)]/50 border border-[color:var(--color-border)]" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-[0.95rem] font-bold text-text tracking-wide drop-shadow-sm">
                    {serverName || 'ZIMPLY'}
                  </span>
                </div>
              </>
            )}
          </div>
          
          {/* Mittlerer Bereich: Telemetry Bar (Neu) */}
          {selectedServerId && (
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
                <span className="t-val text-text" id="time">
                  {uptimeDisplay}
                </span>
              </div>
            </div>
          )}

          {/* Rechter Bereich: Actions */}
          <div className="flex items-center gap-2 no-drag">
            {selectedServerId && (
              <>
                 <Button 
                    type="button"
                    className={classNames("pill", {active: showLogPanel})}
                    onClick={() => setShowLogPanel(!showLogPanel)}
                    title={showLogPanel ? t('layout.hideLog') : t('layout.showLog')}
                 >
                    <Icon
                      icon={ChevronDown}
                      size="sm"
                      tone="default"
                      className={classNames('text-inherit', showLogPanel ? '' : 'rotate-180')}
                    />
                 </Button>
                {isMobileLayout && (
                  <Button
                    type="button"
                    className={classNames('pill mobile-info-toggle', { active: showRightSidebar })}
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    aria-expanded={showRightSidebar}
                    aria-controls="member-drawer"
                    title={showRightSidebar ? t('layout.hideMembers') : t('layout.showMembers')}
                    ref={mobileInfoButtonRef}
                  >
                    <Icon icon={Users} size="sm" tone="default" className="text-inherit" />
                    <span className="mobile-info-label">{t('layout.showMembers', { defaultValue: 'Mitglieder' })}</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        {/* --- 3. TREE (Channels Links) --- */}
        {selectedServerId && (
          <aside
            ref={leftSidebarRef}
            className="ct-channel-sidebar__panel no-drag relative"
            aria-hidden={isMobileLayout ? !showMobileNav : !showLeftSidebar}
          >
            <div className="ct-channel-sidebar__content custom-scrollbar flex-1 overflow-hidden">
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
              {!isMobileLayout && showLeftSidebar && (
                <SidebarResizer
                  side="left"
                  value={effectiveLeftSidebarWidth}
                  min={minSidebarWidth}
                  max={computedMaxSidebarWidth}
                  onChange={(nextValue) => setLeftSidebarWidth(clampSidebarWidth(nextValue))}
                  onReset={() => setLeftSidebarWidth(clampSidebarWidth(defaultChannelWidth))}
                />
              )}
            </div>
          </aside>
        )}

        {/* --- 4. MAIN STAGE (Mitte) --- */}
        <main ref={mainContentRef} id="main-content" tabIndex={-1} className="main-panel no-drag relative flex flex-col">
          {!isMobileLayout && selectedServerId && (
            <>
              <IconButton
                type="button"
                className="edge-toggle edge-left"
                onClick={() => setShowLeftSidebar((prev) => !prev)}
                aria-label={showLeftSidebar ? t('layout.hideChannels', { defaultValue: 'Kanäle ausblenden' }) : t('layout.showChannels', { defaultValue: 'Kanäle einblenden' })}
              >
                <Icon icon={ChevronLeft} size="md" tone="default" className="text-inherit" />
              </IconButton>
              {selectedServerId && (
                <IconButton
                  type="button"
                  className="edge-toggle edge-right"
                  onClick={() => setShowRightSidebar((prev) => !prev)}
                  aria-label={showRightSidebar ? t('layout.hideMembers', { defaultValue: 'Mitglieder ausblenden' }) : t('layout.showMembers', { defaultValue: 'Mitglieder einblenden' })}
                >
                  <Icon icon={ChevronRight} size="md" tone="default" className="text-inherit" />
                </IconButton>
              )}
            </>
          )}
           {/* Mobile Toggle Row falls nötig, oder via Header gelöst */}
          <div className="main-content flex flex-1 h-full min-h-0 relative">
              {renderContent()}
          </div>
        </main>

        {/* --- 5. INFO (Members Rechts) --- */}
        {selectedServerId && (
          <aside
            ref={rightSidebarRef}
            id="member-drawer"
            className={classNames('info-panel no-drag relative', {
              'mobile-info-panel': isMobileLayout,
            })}
            aria-hidden={isMobileLayout ? !showRightSidebar : !showRightSidebar}
            aria-modal={isMobileLayout && showRightSidebar}
            role={isMobileLayout ? 'dialog' : 'complementary'}
          >
            <div className="info-content custom-scrollbar h-full overflow-y-auto">
              <MemberSidebar serverId={selectedServerId} />
              {!isMobileLayout && showRightSidebar && (
                <SidebarResizer
                  side="right"
                  value={effectiveRightSidebarWidth}
                  min={minSidebarWidth}
                  max={computedMaxSidebarWidth}
                  onChange={(nextValue) => setRightSidebarWidth(clampSidebarWidth(nextValue))}
                  onReset={() => setRightSidebarWidth(clampSidebarWidth(defaultMemberWidth))}
                />
              )}
            </div>
          </aside>
        )}

        {/* --- 6. LOG (Unten) --- */}
        {selectedServerId && (
          <footer
            className="log-panel no-drag flex flex-col shadow-2xl z-50 backdrop-blur-xl bg-[rgba(8,8,10,0.9)] border-t border-[color:var(--color-border)]/70"
            style={{ display: isMobileLayout && !showLogPanel ? 'none' : undefined }}
            aria-hidden={!showLogPanel && !isMobileLayout}
          >
            {/* Log Header */}
            <div className="log-head h-9 bg-[color:var(--color-surface-hover)] border-b border-[color:var(--color-border)]/70 flex items-center px-3 gap-2">
              {logTabs.map((tab) => (
                <Button
                    key={tab.id}
                    type="button"
                    variant="ghost"
                    className={classNames("pill", { active: logFilter === tab.id })}
                    onClick={() => setLogFilter(tab.id as any)}
                >
                    {tab.label}
                </Button>
              ))}
              <div style={{flex:1}} className="drag-handle h-full" />
              <Button 
                type="button"
                variant="ghost"
                className="pill hover:bg-[color:var(--color-surface-hover)] cursor-pointer text-xs px-4 py-1 rounded-full text-[color:var(--color-text-muted)] transition-colors" 
                onClick={() => clearLogEntries()}
                title={t('layout.log.clear')}
              >
                Clear
              </Button>
            </div>

            {/* Log Body */}
            {showLogPanel && (
              <>
                <div ref={logBodyRef} className="log-body flex-1 overflow-y-auto p-4 font-mono text-xs text-[color:var(--color-text)] leading-relaxed custom-scrollbar">
                  {filteredLogEntries.length === 0 && (
                    <div className="text-[color:var(--color-text-muted)] text-center py-4 italic">
                      {t('layout.log.empty', { defaultValue: 'Keine Einträge' })}
                    </div>
                  )}
                  {filteredLogEntries.map((entry) => (
                    <div key={entry.id} className="ln mb-0.5">
                      <span className="ts text-[color:var(--color-text-muted)] mr-2">[{formatLogTime(entry.createdAt)}]</span>
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
                <form className="log-cmd bg-[color:var(--color-surface)]/50 border-t border-[color:var(--color-border)]/70 p-2 px-4 flex items-center gap-2" onSubmit={handleLogCommand}>
                  <span className="text-emerald-500 font-bold">&gt;</span>
                  <Input
                    className="bg-transparent border-0 text-text w-full font-mono text-[13px] placeholder:text-[color:var(--color-text-muted)]"
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
