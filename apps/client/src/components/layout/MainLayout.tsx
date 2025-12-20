import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { ChevronDown, ChevronLeft, ChevronRight, Users, Menu, X } from 'lucide-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { useTranslation } from 'react-i18next';

import { ServerRail } from './ServerRail';
import { MemberSidebar } from './MemberSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { TitleBar } from '../window/TitleBar';
import { TopBarProvider } from '../window/TopBarContext';

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

import { useVoice, type VoiceContextType } from '../../features/voice';
import { useOnboardingReplay, type OnboardingReplayKey } from '../../features/onboarding/useOnboardingReplay';
import { storage } from '../../shared/config/storage';
import { defaultHotkeySettings, useSettings } from '../../context/SettingsContext';
import { applyAppTheme, buildAppTheme } from '../../theme/appTheme';

const defaultChannelWidth = 256;
const defaultMemberWidth = 256;
const minSidebarWidth = 200;
const maxSidebarWidth = 420;

// Breakpoint für Mobile/Desktop Umschaltung (entspricht Tailwind 'lg')
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
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  
  // Resizable Widths (Desktop)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => storage.get('layoutLeftWidth'));
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => storage.get('layoutRightWidth'));
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  
  // Logic Refs
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const memberSheetRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;
  
  // App Data State
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverName, setServerName] = useState<string>('');
  const [titlebarHeight, setTitlebarHeight] = useState<number>(48);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [fallbackChannel, setFallbackChannel] = useState<Channel | null>(null);
  
  // Modals & Popups
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
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

  // Voice Context
  const {
    activeRoom,
    activeChannelId: connectedVoiceChannelId,
    activeChannelName: connectedVoiceChannelName,
    connectionState,
    muted,
    connectToChannel,
  } = useVoice();

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

  const focusContainer = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
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
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (typeof window === 'undefined') return;
      if (!touchStartRef.current) return;
      if (window.innerWidth >= MOBILE_BREAKPOINT) return;

      const touch = event.changedTouches[0];
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
        if (deltaY < 0 && !showMemberSheet && touchStartRef.current.y > viewportHeight - 160) {
          setShowMemberSheet(true);
        } else if (deltaY > 0 && showMemberSheet) {
          setShowMemberSheet(false);
        }
      }

      touchStartRef.current = null;
    },
    [selectedServerId, showMemberSheet, showMobileNav]
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

  // --- LocalStorage für Sidebar Breite ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLeft = storage.get('layoutLeftWidth');
    setLeftSidebarWidth(clampSidebarWidth(storedLeft));

    const storedRight = storage.get('layoutRightWidth');
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

  // --- Auto-Close Mobile Nav on Selection ---
  useEffect(() => {
    setShowMemberSheet(false);
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

  useEffect(() => {
    if (showMobileNav) {
      recordPreviousFocus();
      focusContainer(mobileNavRef.current);
    }
  }, [focusContainer, showMobileNav]);

  useEffect(() => {
    if (showMemberSheet) {
      recordPreviousFocus();
      focusContainer(memberSheetRef.current);
    }
  }, [focusContainer, showMemberSheet]);

  useEffect(() => {
    if (showCommandPalette) {
      recordPreviousFocus();
    }
  }, [recordPreviousFocus, showCommandPalette]);

  useEffect(() => {
    if (showMobileNav || showMemberSheet || showCommandPalette) {
      return;
    }
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [showCommandPalette, showMemberSheet, showMobileNav]);

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

      if (eventMatchesHotkey(event, resolvedHotkeys.toggleNavigation)) {
        if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
          event.preventDefault();
          setShowMobileNav((prev) => {
            if (!prev) recordPreviousFocus();
            return !prev;
          });
        }
        return;
      }

      if (eventMatchesHotkey(event, resolvedHotkeys.toggleMembers)) {
        if (!selectedServerId) return;
        event.preventDefault();
        if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
          setShowMemberSheet((prev) => {
            if (!prev) recordPreviousFocus();
            return !prev;
          });
          return;
        }
        setShowRightSidebar((prev) => !prev);
        return;
      }

      if (eventMatchesHotkey(event, resolvedHotkeys.skipToContent)) {
        event.preventDefault();
        focusMainContent();
      }
    };

    document.addEventListener('keydown', handleGlobalHotkeys);
    return () => document.removeEventListener('keydown', handleGlobalHotkeys);
  }, [focusMainContent, recordPreviousFocus, resolvedHotkeys, selectedServerId]);

  useEffect(() => {
    if (!showMobileNav && !showMemberSheet) return;

    const target = showMemberSheet ? memberSheetRef.current : mobileNavRef.current;
    if (!target) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showMemberSheet) {
          setShowMemberSheet(false);
        } else {
          setShowMobileNav(false);
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(target);
      if (focusable.length === 0) {
        target.focus();
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !target.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      } else if (!active || !target.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMemberSheet, showMobileNav]);

  // --- Handlers ---
  const handleServerSelect = useCallback((id: number | null) => {
    setSelectedServerId(id);
    setActiveChannel(null);
    setFallbackChannel(null);
    setShowServerSettings(false);
  }, []);

  const handleChannelSelect = useCallback((channel: Channel) => {
    setActiveChannel(channel);
    if (channel.type === 'voice') {
      setPendingVoiceChannelId(channel.id);
    } else {
      setPendingVoiceChannelId(null);
      setLastNonVoiceChannel(channel);
    }
    setShowMobileNav(false); 
  }, []);

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
      setShowMemberSheet(true);
      return;
    }
    setShowRightSidebar(true);
  }, [selectedServerId]);

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
      // ... (Voice logic bleibt gleich)
      if (isConnectedToTarget) {
        return <VoiceChannelView channelName={activeChannel.name} />;
      }
      return (
        <VoicePreJoin
          channel={activeChannel}
          onJoin={() => attemptVoiceJoin(activeChannel)}
          onCancel={handleVoiceCancel}
          isJoining={pendingVoiceChannelId === activeChannel.id && (connectionState === 'connecting' || connectionState === 'reconnecting')}
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

  const ui = (
    <TopBarProvider>
    <div
      ref={layoutRef}
      style={isDesktop ? { paddingTop: titlebarHeight } : undefined}
      className={classNames(
        "flex h-screen w-screen overflow-visible relative bg-[var(--color-background)] text-[color:var(--color-text)] font-sans box-border"
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          focusMainContent();
        }}
        className="sr-only focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 absolute top-2 left-2 z-[70] bg-[var(--color-surface)] text-white px-3 py-2 rounded-md border border-[var(--color-border)] shadow-lg"
      >
        {t('layout.skipToContent', { defaultValue: 'Skip to content' })}
      </a>
      {isDesktop && <TitleBar serverName={serverName} channel={activeChannel} showRightSidebar={showRightSidebar} onToggleRightSidebar={() => setShowRightSidebar((v) => !v)} onOpenServerSettings={handleOpenServerSettings} />}

      {/* --- GLOBAL MODALS --- */}
      {showOnboarding && (
        <OnboardingModal
          onClose={resolveOnboarding}
          initialStep={onboardingConfig?.initialStep ?? 0}
          onStepAction={handleOnboardingStepAction}
        />
      )}
      {showCreateServer && <CreateServerModal onClose={() => setShowCreateServer(false)} onCreated={() => { announceServerChange(); setShowCreateServer(false); }} />}
      {showJoinServer && <JoinServerModal onClose={() => setShowJoinServer(false)} onJoined={() => { announceServerChange(); setShowJoinServer(false); }} />}
      {selectedServerId && showServerSettings && (
        <ServerSettingsModal serverId={selectedServerId} onClose={() => setShowServerSettings(false)} onUpdated={handleServerUpdated} onDeleted={handleServerDeleted} />
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

      {/* Overlay Backdrop für Mobile */}
      <div 
        className={classNames(
          "fixed inset-0 bg-black/80 z-40 lg:hidden transition-opacity duration-300",
          showMobileNav ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setShowMobileNav(false)}
      />

      {/* Navigation Container */}
      <div className={classNames(
        "flex h-full z-50 transition-transform duration-300 ease-in-out",
        "lg:relative lg:translate-x-0",
        "fixed inset-y-0 left-0 max-lg:w-[85vw] max-lg:max-w-[320px]",
        showMobileNav ? "translate-x-0" : "max-lg:-translate-x-full"
      )}
        ref={mobileNavRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMobileNav}
        tabIndex={-1}
      >
        
        {/* 1. SERVER RAIL - Hier werden jetzt die Props übergeben! */}
        {/*
          The ServerRail contains a popover (Create/Join) that overflows into the ChannelSidebar.
          When a server is selected, the ChannelSidebar is rendered after the rail and creates its
          own stacking context (backdrop-filter/overflow), which can paint above the rail popover.
          Give the rail a higher stacking context so the popover stays visible.
        */}
        <div className="w-[80px] flex-shrink-0 flex flex-col items-center py-3 h-full relative z-[80]">
           <div className="w-full h-full bg-[var(--color-surface)] bg-opacity-90 backdrop-blur-xl rounded-2xl border border-[var(--color-border)] ml-3 shadow-2xl overflow-visible relative z-[80]">
             <ServerRail
                selectedServerId={selectedServerId}
                onSelectServer={handleServerSelect}
                onCreateServer={handleCreateServer}
                onJoinServer={handleJoinServer}
             />
           </div>
        </div>

        {/* 2. CHANNEL SIDEBAR */}
        {selectedServerId && (
            <div 
                ref={leftSidebarRef}
                className="h-full py-3 pl-3 flex-shrink-0 transition-all duration-300 relative z-[60]"
                style={{ width: typeof window !== 'undefined' && window.innerWidth < 1024 ? 'calc(100% - 80px)' : leftSidebarWidth }}
            >
                <div className="w-full h-full bg-[var(--color-surface)] bg-opacity-90 backdrop-blur-xl rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col relative">
                    <ChannelSidebar onServerNameChange={(name) => setServerName(name)}
                        serverId={selectedServerId}
                        activeChannelId={activeChannel?.id || null}
                        onSelectChannel={handleChannelSelect}
                        onOpenServerSettings={() => {
                          handleOpenServerSettings();
                          setShowMobileNav(false);
                        }}
                        onCloseMobileNav={() => setShowMobileNav(false)}
                        onResolveFallback={handleResolveFallback}
                        refreshKey={serverRefreshKey}
                    />
                </div>
                <div className="hidden lg:block absolute top-0 right-0 h-full w-2 cursor-ew-resize hover:bg-white/5" onMouseDown={startDragLeft} />
            </div>
        )}
      </div>

      {/* === MAIN CONTENT AREA === */}
      <div
        ref={mainContentRef}
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col min-w-0 relative h-full py-3 px-3 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {/* MOBILE HEADER */}
        <div className="lg:hidden flex items-center gap-3 mb-3 px-1">
            <button
                onClick={() => setShowMobileNav(true)}
                className="p-2 bg-[#1a1b1e] rounded-xl border border-white/10 text-white shadow-lg active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
                <Menu size={20} />
            </button>
            <span className="font-bold text-white truncate">
                {activeChannel?.name || "Chat"}
            </span>
            {selectedServerId && (
                <button
                    onClick={() => setShowMemberSheet(true)}
                    className="ml-auto p-2 bg-[#1a1b1e] rounded-xl border border-white/10 text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                    <Users size={20} />
                </button>
            )}
        </div>

        <div className="flex-1 bg-[var(--color-surface-alt)] rounded-2xl border border-[var(--color-border)] relative overflow-hidden shadow-2xl flex flex-col">
          {renderContent()}
        </div>

        {/* Desktop Member Toggle */}
        {selectedServerId && (
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-black/50 hover:bg-indigo-600 rounded-l-xl backdrop-blur-md items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            style={{ right: showRightSidebar ? 12 : 12 }}
          >
            {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* MEMBER SIDEBARS (Desktop & Mobile) - Code unverändert übernommen ... */}
      {selectedServerId && (
        <div
          ref={rightSidebarRef}
          className={classNames(
            'hidden lg:block transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] relative z-40 h-full py-3 pr-3',
            showRightSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pr-0'
          )}
          style={{ width: showRightSidebar ? rightSidebarWidth : 0 }}
        >
          <div className="w-full h-full bg-[var(--color-surface)] bg-opacity-80 backdrop-blur-xl rounded-2xl border border-[var(--color-border)] overflow-hidden">
            <MemberSidebar serverId={selectedServerId} />
          </div>
          {showRightSidebar && (
            <div className="absolute top-0 left-0 h-full w-2 cursor-ew-resize hover:bg-white/5" onMouseDown={startDragRight} />
          )}
        </div>
      )}

      {selectedServerId && (
        <div
          className={classNames(
            'lg:hidden fixed inset-x-0 bottom-0 z-[60] transition-transform duration-500',
            showMemberSheet ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="absolute inset-0 h-screen bg-black/60 backdrop-blur-sm -top-[100vh]" onClick={() => setShowMemberSheet(false)} style={{ display: showMemberSheet ? 'block' : 'none' }} />
          <div
            ref={memberSheetRef}
            role="dialog"
            aria-modal="true"
            aria-hidden={!showMemberSheet}
            tabIndex={-1}
            className="relative bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-3xl overflow-hidden shadow-2xl h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={16} />
                Mitglieder
              </div>
              <button onClick={() => setShowMemberSheet(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-200">
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MemberSidebar serverId={selectedServerId} />
            </div>
          </div>
        </div>
      )}

      {activeRoom && !muted && <RoomAudioRenderer />}
    </div>
    </TopBarProvider>
  );

  if (!activeRoom) return ui;
  return <RoomContext.Provider value={activeRoom}>{ui}</RoomContext.Provider>;
};