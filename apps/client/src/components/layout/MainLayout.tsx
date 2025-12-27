import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users, Menu } from 'lucide-react';
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
import { UserSettingsModal } from '../modals/UserSettingsModal'; // NEU: Importiert

import { useVoice, type VoiceContextType } from '../../features/voice';
import { useOnboardingReplay, type OnboardingReplayKey } from '../../features/onboarding/useOnboardingReplay';
import { storage } from '../../shared/config/storage';
import { defaultHotkeySettings, useSettings } from '../../context/SettingsContext';
import { applyAppTheme, buildAppTheme } from '../../theme/appTheme';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';
import { useLogStore } from '../../store/useLogStore';
import { useSocket } from '../../context/SocketContext';

const defaultChannelWidth = 256;
const defaultMemberWidth = 256;
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

  // Wenn die Mobile-Navigation geschlossen wird, darf kein Fokus in einem aria-hidden Bereich "hängen bleiben".
  // Sonst kommt es zu Warnungen (und in Electron teils zu focus/keyboard glitches).
  useEffect(() => {
    if (showMobileNav) return;

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;

    const navContainers = [leftSidebarRef.current, railRef.current];
    if (navContainers.some((node) => node && node.contains(active))) {
      active.blur();
      // Fokus zurück auf den Trigger-Button, damit Screenreader/Keyboard nicht im Offcanvas hängen.
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
  const lastConnectionStateRef = useRef(connectionState);
  const lastSocketConnectedRef = useRef<boolean | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;
  
  // App Data State
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverName, setServerName] = useState<string>('');
  const [serverIcon, setServerIcon] = useState<string | null>(null); // NEU: Server Icon State
  const [titlebarHeight, setTitlebarHeight] = useState<number>(48);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [fallbackChannel, setFallbackChannel] = useState<Channel | null>(null);
  
  // Modals & Popups
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false); // NEU: User Settings State
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
  } = useVoice();
  const AudioRenderer = providerRenderers.AudioRenderer;
  const DebugOverlay = providerRenderers.DebugOverlay;
  const { isConnected: socketConnected } = useSocket();

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

  // ... (Focus logic remains the same)
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

  // ... (Touch logic remains the same)
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

  // --- Width Calculation Logic ---
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

  // --- LocalStorage für Sidebar Breite ---
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

  // --- Resize Observer ---
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

  // --- Auto-Close Mobile Nav on Selection ---
  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
        setShowMobileNav(false);
    }
  }, [activeChannel?.id]);

  // --- Fallback Channel Logic ---
  useEffect(() => {
    if (!activeChannel && fallbackChannel) {
      setActiveChannel(fallbackChannel);
      if (fallbackChannel.type !== 'voice') {
        setPendingVoiceChannelId(null);
        setLastNonVoiceChannel(fallbackChannel);
      }
    }
  }, [activeChannel, fallbackChannel]);

  // --- Voice Connection Handling ---
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

  // --- Onboarding Check ---
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

  // ... (Effect hooks for focus management remain the same)

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
      // ... (other hotkeys)
    };
    document.addEventListener('keydown', handleGlobalHotkeys);
    return () => document.removeEventListener('keydown', handleGlobalHotkeys);
  }, [focusMainContent, recordPreviousFocus, resolvedHotkeys, selectedServerId]);

  // ... (Handlers)

  const handleServerSelect = useCallback((id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setFallbackChannel(null);
    setShowServerSettings(false);
    setServerIcon(null); // Reset Icon
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
    // ... (rest of renderContent logic logic remains same as before)
    if (activeChannel?.type === 'web') {
      return <WebChannelView channelId={activeChannel.id} channelName={activeChannel.name} />;
    }
    if (activeChannel?.type === 'text') {
       // ... text channel logic
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
      // ... voice logic
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
      { id: 'all', label: t('layout.log.tabs.all', { defaultValue: 'Alle' }), count: logEntries.length },
      { id: 'system', label: t('layout.log.tabs.system', { defaultValue: 'System' }), count: counts.system ?? 0 },
      { id: 'voice', label: t('layout.log.tabs.voice', { defaultValue: 'Voice' }), count: counts.voice ?? 0 },
      { id: 'chat', label: t('layout.log.tabs.chat', { defaultValue: 'Chat' }), count: counts.chat ?? 0 },
    ];
  }, [logEntries, t]);

  const formatLogTime = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleTimeString('de-DE', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
  }, [filteredLogEntries]);

  const layoutClassName = classNames('main-layout', {
    'fold-tree': !showLeftSidebar && !isMobileLayout,
    'fold-info': !showRightSidebar && !isMobileLayout,
    'fold-log': !showLogPanel && !isMobileLayout,
    'mobile-nav-open': showMobileNav,
      // TEMPNEW compatibility aliases
    'fold-left': !showLeftSidebar && !isMobileLayout,
    'fold-right': !showRightSidebar && !isMobileLayout,
  });

  const gridStyle = {
    '--layout-tree-current': isMobileLayout ? '0px' : showLeftSidebar ? `${effectiveLeftSidebarWidth}px` : '0px',
    '--layout-info-current': isMobileLayout ? '0px' : showRightSidebar ? `${effectiveRightSidebarWidth}px` : '0px',
    '--layout-log-current': showLogPanel ? 'var(--layout-log-height)' : '0px',
    // TEMPNEW compatibility (see theme/tempnew.css)
    '--curr-tree': isMobileLayout ? '0px' : showLeftSidebar ? `${effectiveLeftSidebarWidth}px` : '0px',
    '--curr-info': isMobileLayout ? '0px' : showRightSidebar ? `${effectiveRightSidebarWidth}px` : '0px',

  } as React.CSSProperties;

  const ui = (
    <TopBarProvider>
      <div className={layoutClassName} style={isDesktop ? { paddingTop: titlebarHeight } : undefined}>
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

        {/* --- GLOBAL MODALS --- */}
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

        <div className="overlay-orb orb-a" aria-hidden />
        <div className="overlay-orb orb-b" aria-hidden />
        <div className="mobile-overlay" onClick={() => setShowMobileNav(false)} />

        <div
          ref={layoutRef}
          className="layout-grid"
          style={gridStyle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="pattern" aria-hidden />

          <aside
            ref={railRef}
            className="rail-panel glass-panel rail"
            role={isMobileLayout ? 'dialog' : 'complementary'}
            aria-modal={isMobileLayout}
            aria-hidden={!showMobileNav && isMobileLayout}
          >
            <ServerRail
              selectedServerId={selectedServerId}
              onSelectServer={handleServerSelect}
              onCreateServer={handleCreateServer}
              onJoinServer={handleJoinServer}
            />
          </aside>

          <header className="header-panel glass-panel header">
            <div className="header-left">
              {isMobileLayout && (
                <button
                  className="icon-button"
                  onClick={() => setShowMobileNav(true)}
                  ref={mobileNavButtonRef}
                  aria-label={t('layout.showNavigation', { defaultValue: 'Navigation öffnen' })}
                >
                  <Menu size={18} />
                </button>
              )}
              <div className="path-chip">
                {serverIcon ? (
                  <img src={serverIcon} alt="" className="server-icon" />
                ) : (
                  <span className="status-dot" aria-hidden />
                )}
                <div className="path-labels">
                  <span className="path-primary">
                    {serverName || t('layout.serverFallback', { defaultValue: 'Server auswählen' })}
                  </span>
                  <span className="path-secondary">
                    {activeChannel?.name || t('layout.noChannel', { defaultValue: 'Kein Kanal ausgewählt' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="header-actions">
              <div className="pill">
                <span className="status-dot" aria-hidden />
                {t('layout.statusOnline', { defaultValue: 'Live' })}
              </div>
              {selectedServerId && (
                <>
                  <button
                    className="icon-button ghost"
                    onClick={() => setShowLogPanel((value) => !value)}
                    aria-pressed={showLogPanel}
                  >
                    <ChevronDown size={16} />
                    {showLogPanel
                      ? t('layout.hideLog', { defaultValue: 'Log einklappen' })
                      : t('layout.showLog', { defaultValue: 'Log anzeigen' })}
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setShowRightSidebar((value) => !value)}
                    aria-pressed={showRightSidebar}
                  >
                    <Users size={16} />
                    {showRightSidebar
                      ? t('layout.hideMembers', { defaultValue: 'Info ausblenden' })
                      : t('layout.showMembers', { defaultValue: 'Info anzeigen' })}
                  </button>
                </>
              )}
            </div>
          </header>

          {selectedServerId && (
            <section
              ref={leftSidebarRef}
              className="tree-panel glass-panel tree-wrapper tree"
              aria-hidden={!showLeftSidebar && !isMobileLayout}
            >
              <div className="tree-content">
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
                {!isMobileLayout && showLeftSidebar && <div className="tree-resizer" onMouseDown={startDragLeft} />}
              </div>
            </section>
          )}

          <main ref={mainContentRef} id="main-content" tabIndex={-1} className="main-panel glass-panel main">
            {isMobileLayout && (
              <div className="mobile-toggle-row">
                <button
                  className="icon-button"
                  onClick={() => setShowMobileNav(true)}
                  ref={mobileNavButtonRef}
                  aria-label={t('layout.showNavigation', { defaultValue: 'Navigation öffnen' })}
                >
                  <Menu size={18} />
                </button>
                <span className="pill pill-muted">{activeChannel?.name || 'Chat'}</span>
                {selectedServerId && (
                  <>
                    <button
                      className="icon-button"
                      onClick={() => setShowRightSidebar((value) => !value)}
                      aria-pressed={showRightSidebar}
                    >
                      <Users size={18} />
                      {t('layout.showMembers', { defaultValue: 'Info' })}
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => setShowLogPanel((value) => !value)}
                      aria-pressed={showLogPanel}
                    >
                      <ChevronDown size={16} />
                      {t('layout.log.title', { defaultValue: 'Log' })}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="main-content">
              <div className="main-frame">
                <div className="pattern" aria-hidden />
                {renderContent()}
              </div>
            </div>
          </main>

          {selectedServerId && (
            <aside
              ref={rightSidebarRef}
              className="info-panel glass-panel info-wrapper info-wrap"
              style={{ display: isMobileLayout && !showRightSidebar ? 'none' : undefined }}
              aria-hidden={!showRightSidebar && !isMobileLayout}
            >
              <div className="tree-content">
                <MemberSidebar serverId={selectedServerId} />
                {!isMobileLayout && showRightSidebar && <div className="info-resizer" onMouseDown={startDragRight} />}
              </div>
            </aside>
          )}

          {selectedServerId && (
            <section
              className="log-panel glass-panel log"
              style={{ display: isMobileLayout && !showLogPanel ? 'none' : undefined }}
              aria-hidden={!showLogPanel && !isMobileLayout}
            >
              <div className="log-header">
                <div className="log-title">
                  <ChevronDown size={16} />
                  {t('layout.log.title', { defaultValue: 'Log' })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="icon-button ghost"
                    onClick={() => clearLogEntries()}
                    disabled={!logEntries.length}
                  >
                    {t('layout.log.clear', { defaultValue: 'Leeren' })}
                  </button>
                  <button
                    className="icon-button ghost"
                    onClick={() => setShowLogPanel((value) => !value)}
                    aria-pressed={showLogPanel}
                  >
                    {showLogPanel
                      ? t('layout.hideLog', { defaultValue: 'Einklappen' })
                      : t('layout.showLog', { defaultValue: 'Log' })}
                  </button>
                </div>
              </div>
              {showLogPanel && (
                <>
                  <div className="log-tabs">
                    {logTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={`log-tab ${logFilter === tab.id ? 'active' : ''}`}
                        onClick={() => setLogFilter(tab.id)}
                        type="button"
                      >
                        {tab.label}
                        <span className="log-tab-count">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                  <div ref={logBodyRef} className="log-body custom-scrollbar">
                    {filteredLogEntries.length === 0 && (
                      <div className="log-empty">
                        {t('layout.log.empty', { defaultValue: 'Keine Einträge' })}
                      </div>
                    )}
                    {filteredLogEntries.map((entry) => (
                      <div key={entry.id} className="log-line">
                        <span className="log-time">{formatLogTime(entry.createdAt)}</span>
                        <span className={`log-tag log-${entry.category}`}>{entry.category}</span>
                        <span className="log-text-mono">{entry.message}</span>
                      </div>
                    ))}
                  </div>
                  <form className="log-command" onSubmit={handleLogCommand}>
                    <span className="log-prompt">›</span>
                    <input
                      value={logInput}
                      onChange={(event) => setLogInput(event.target.value)}
                      placeholder={t('layout.log.commandPlaceholder', { defaultValue: '/voice <cmd> oder /chat <cmd>' }) ?? ''}
                    />
                    <button type="submit" className="icon-button">
                      {t('layout.log.send', { defaultValue: 'Senden' })}
                    </button>
                  </form>
                </>
              )}
            </section>
          )}

          {selectedServerId && (
            <>
              <button
                onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                className="sidebar-toggle toggle-left"
                aria-label={
                  showLeftSidebar
                    ? t('layout.hideNavigation', { defaultValue: 'Navigation ausblenden' })
                    : t('layout.showNavigation', { defaultValue: 'Navigation einblenden' })
                }
              >
                {showLeftSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
              <button
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                className="sidebar-toggle toggle-right"
                aria-label={
                  showRightSidebar
                    ? t('layout.hideMembers', { defaultValue: 'Info ausblenden' })
                    : t('layout.showMembers', { defaultValue: 'Info einblenden' })
                }
              >
                {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </>
          )}
        </div>
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
