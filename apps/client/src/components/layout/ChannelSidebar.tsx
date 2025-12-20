import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Hash, Volume2, Settings, Plus, ChevronDown, ChevronRight, Globe, Mic, PhoneOff, Camera, ScreenShare, Lock, ListChecks, X, Search, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiFetch } from '../../api/http';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { UserBottomBar } from './UserBottomBar';
import { useVoice } from '../../features/voice';
import { VoiceParticipantsPanel } from '../../features/voice/ui';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext'; // Für aktuellen DisplayName
import { defaultServerTheme, deriveServerThemeFromSettings, type ServerTheme } from '../../theme/serverTheme';
import { storage } from '../../shared/config/storage';
import { ErrorCard, Skeleton, Spinner } from '../ui';

interface Channel { id: number; name: string; type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list'; custom_icon?: string; }
interface Category { id: number; name: string; channels: Channel[]; }
const categoryKey = (categoryId: number) => `category-${categoryId}`;
const channelKey = (channelId: number, parentKey: string) => `${parentKey}-channel-${channelId}`;

interface SortableWrapperProps<T> {
  item: T;
  id: string;
  data: Record<string, any>;
  disabled?: boolean;
  children: (props: {
    handleProps: Record<string, unknown>;
    setNodeRef: (element: HTMLElement | null) => void;
    style: CSSProperties;
    isDragging: boolean;
    isDisabled: boolean;
  }) => React.ReactNode;
}

const SortableWrapper = <T,>({ item: _, id, data, disabled, children }: SortableWrapperProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>{children({ handleProps: { ...attributes, ...listeners }, setNodeRef, style, isDragging, isDisabled: Boolean(disabled) })}</>
  );
};
interface ChannelSidebarProps {
  serverId: number | null;
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenServerSettings: () => void;
  onServerNameChange?: (name: string) => void;
  onCloseMobileNav?: () => void;
  onResolveFallback?: (channel: Channel | null) => void;
  refreshKey?: number;
}

export const ChannelSidebar = ({ serverId, activeChannelId, onSelectChannel, onOpenServerSettings, onServerNameChange, onCloseMobileNav, onResolveFallback, refreshKey = 0 }: ChannelSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState<Channel[]>([]);
  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    if (serverName) onServerNameChange?.(serverName);
  }, [serverName, onServerNameChange]);

  const [serverTheme, setServerTheme] = useState<ServerTheme>(defaultServerTheme);
  const [serverThemeSource, setServerThemeSource] = useState<any>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<Channel['type']>('text');
  const [createCategoryId, setCreateCategoryId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    userId: number;
    username: string;
    channelId: number | null;
    channelName?: string;
    x: number;
    y: number;
    target?: HTMLElement | null;
    moveTargetId?: number | null;
  } | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{
    previous: { categories: Category[]; uncategorized: Channel[] };
    next: { categories: Category[]; uncategorized: Channel[] };
  } | null>(null);
  const [isSavingStructure, setIsSavingStructure] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const retryTimer = useRef<NodeJS.Timeout | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  // CONTEXTS
  const { settings, updateDevices } = useSettings();
  const { t } = useTranslation();
  const {
    activeRoom,
    activeChannelId: voiceChannelId,
    connectionState,
    activeChannelName,
    disconnect,
    isCameraEnabled,
    isScreenSharing,
    toggleCamera,
    toggleScreenShare,
    cameraError,
    screenShareError,
    isPublishingCamera,
    isPublishingScreen,
    selectedAudioInputId,
    selectedVideoInputId,
    localAudioLevel,
  } = useVoice();
  const { channelPresence } = useSocket();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  // Lokalen User laden (für ID-Vergleich)
  const localUser = useMemo(() => storage.get('cloverUser'), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const voiceChannels = useMemo(
    () =>
      [...uncategorized, ...categories.flatMap((cat) => cat.channels)]
        .filter((ch) => ch.type === 'voice')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, uncategorized]
  );

  const participantCount = activeRoom ? activeRoom.numParticipants : 0;
  const shouldShowVoiceParticipants = connectionState === 'connected' && participantCount > 0;

  const accentColor = useMemo(
    () => (serverId ? settings.theme.serverAccents?.[serverId] ?? settings.theme.accentColor : settings.theme.accentColor),
    [serverId, settings.theme]
  );

  useEffect(() => {
    if (!serverThemeSource) return;
    setServerTheme(deriveServerThemeFromSettings(serverThemeSource, accentColor));
  }, [accentColor, serverThemeSource]);

  const fetchData = useCallback(
    async (attempt = 1) => {
      clearRetryTimer();
      if (!serverId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      if (attempt === 1) setError(null);

      try {
        const srvRes = await apiFetch<any[]>(`/api/servers`);
        const current = srvRes.find((s: any) => s.id === serverId);
        if (current) {
          setServerName(current.name);
          setServerThemeSource(current.settings || current.theme);
          setServerTheme(deriveServerThemeFromSettings(current.settings || current.theme, accentColor));
        }
        const structRes = await apiFetch<{ categories: Category[]; uncategorized: Channel[]; fallbackChannelId?: number | null }>(`/api/servers/${serverId}/structure`);
        setCategories(structRes.categories);
        setUncategorized(structRes.uncategorized);

        const allChannels = [...structRes.uncategorized, ...structRes.categories.flatMap((c) => c.channels)];
        const fallbackChannel =
          allChannels.find((c) => c.id === (structRes.fallbackChannelId ?? null) && c.type !== 'voice' && c.type !== 'spacer') ||
          allChannels.find((c) => c.type !== 'voice' && c.type !== 'spacer') ||
          null;

        onResolveFallback?.(fallbackChannel ?? null);

        if (!activeChannelId && fallbackChannel) {
          onSelectChannel(fallbackChannel);
        }

        setError(null);
        setIsLoading(false);
      } catch (err) {
        console.error(`Failed to load server data (attempt ${attempt})`, err);
        setError(t('channelSidebar.loadError'));
        onResolveFallback?.(null);

        if (attempt < 2) {
          retryTimer.current = setTimeout(() => fetchData(attempt + 1), 1200);
        } else {
          setIsLoading(false);
        }
      }
    },
    [accentColor, activeChannelId, clearRetryTimer, onResolveFallback, onSelectChannel, refreshKey, serverId]
  );
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => () => clearRetryTimer(), [clearRetryTimer]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim().toLowerCase()), 250);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    if (!serverId) return;
    apiFetch<Record<string, boolean>>(`/api/servers/${serverId}/permissions`).then(setPermissions).catch(() => setPermissions({}));
  }, [serverId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (!contextMenu.target) return closeContextMenu();
      if (!(contextMenu.target as HTMLElement).contains(e.target as HTMLElement)) {
        closeContextMenu();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu?.channelId) return;
    const nextOption = voiceChannels.find((vc) => vc.id !== contextMenu.channelId);
    if (!nextOption) return;
    setContextMenu((prev) => (prev ? { ...prev, moveTargetId: prev.moveTargetId || nextOption.id } : prev));
  }, [contextMenu?.channelId, voiceChannels]);

  const handleChannelClick = (c: Channel) => {
    if (c.type === 'spacer') return;
    onSelectChannel(c);
  };

  const closeContextMenu = () => setContextMenu(null);

  const openUserMenu = (
    origin: { x: number; y: number; target?: HTMLElement | null },
    user: any,
    channel?: Channel | null
  ) => {
    if (!permissions.move && !permissions.kick) return;
    setContextMenu({
      userId: user.id,
      username: user.username,
      channelId: channel?.id ?? null,
      ...(channel ? { channelName: channel.name } : {}),
      x: origin.x,
      y: origin.y,
      target: origin.target ?? null,
      moveTargetId: channel?.id ?? null,
    });
  };

  const startLongPress = (handler: () => void) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(handler, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    } catch (err) {
      console.warn('Could not enumerate devices', err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator?.mediaDevices?.addEventListener('devicechange', refreshDevices);
    return () => navigator?.mediaDevices?.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  const handleDeviceChange = async (
    type: 'audioinput' | 'videoinput',
    deviceId: string
  ) => {
    updateDevices({
      audioInputId: type === 'audioinput' ? deviceId || null : settings.devices.audioInputId,
      audioOutputId: settings.devices.audioOutputId,
      videoInputId: type === 'videoinput' ? deviceId || null : settings.devices.videoInputId,
    });

    if (activeRoom && connectionState === 'connected' && deviceId) {
      try {
        await activeRoom.switchActiveDevice(type, deviceId, true);
      } catch (err) {
        console.warn('Could not switch active device', err);
      }
    }
  };

  const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
  const dragDisabled = Boolean(normalizedSearchTerm);
  const matchesSearch = useCallback(
    (channel: Channel) => {
      if (!normalizedSearchTerm) return true;
      const haystack = `${channel.name} ${channel.type}`.toLowerCase();
      return haystack.includes(normalizedSearchTerm);
    },
    [normalizedSearchTerm]
  );

  const filteredUncategorized = useMemo(
    () => uncategorized.filter(matchesSearch),
    [matchesSearch, uncategorized]
  );

  const filteredCategories = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          channels: cat.channels.filter(matchesSearch),
        }))
        .filter((cat) => cat.channels.length > 0),
    [categories, matchesSearch]
  );

  const hasVisibleChannels = filteredUncategorized.length > 0 || filteredCategories.some((cat) => cat.channels.length > 0);

  type SearchRow =
    | { type: 'category'; category: Category; key: string }
    | { type: 'channel'; channel: Channel; parentKey: string; key: string };

  const virtualizedSearchItems = useMemo<SearchRow[]>(() => {
    if (!normalizedSearchTerm) return [];

    const rows: SearchRow[] = [];

    filteredCategories.forEach((cat) => {
      rows.push({ type: 'category', category: cat, key: categoryKey(cat.id) });
      cat.channels.forEach((channel) =>
        rows.push({ type: 'channel', channel, parentKey: categoryKey(cat.id), key: channelKey(channel.id, categoryKey(cat.id)) })
      );
    });

    filteredUncategorized.forEach((channel) => {
      rows.push({ type: 'channel', channel, parentKey: 'uncategorized', key: channelKey(channel.id, 'uncategorized') });
    });

    return rows;
  }, [filteredCategories, filteredUncategorized, normalizedSearchTerm]);

  const searchListParentRef = useRef<HTMLDivElement | null>(null);
  const searchVirtualizer = useVirtualizer({
    count: virtualizedSearchItems.length,
    getScrollElement: () => searchListParentRef.current,
    estimateSize: (index) => (virtualizedSearchItems[index]?.type === 'category' ? 40 : 52),
    overscan: 8,
  });

  const persistStructure = useCallback(
    async (
      nextCategories: Category[],
      nextUncategorized: Channel[],
      previous: { categories: Category[]; uncategorized: Channel[] }
    ) => {
      if (!serverId) return;
      setIsSavingStructure(true);
      setStructureError(null);
      setPendingReorder({ previous, next: { categories: nextCategories, uncategorized: nextUncategorized } });

      try {
        await apiFetch(`/api/servers/${serverId}/structure`, {
          method: 'PUT',
          body: JSON.stringify({
            categories: nextCategories.map((cat) => ({ id: cat.id, channelIds: cat.channels.map((c) => c.id) })),
            uncategorized: nextUncategorized.map((c) => c.id),
          }),
        });
        setPendingReorder(null);
      } catch (err) {
        console.error('Failed to save structure', err);
        setStructureError('Änderungen konnten nicht gespeichert werden. Bitte erneut versuchen.');
      } finally {
        setIsSavingStructure(false);
      }
    },
    [serverId]
  );

  const handleButtonKey = async (
    e: KeyboardEvent<HTMLButtonElement>,
    action: () => Promise<void>
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      await action();
    }
  };

  const performModeration = async (
    action: 'mute' | 'kick' | 'ban' | 'remove' | 'move',
    payload: { userId: number; channelId?: number | null; targetChannelId?: number | null }
  ) => {
    if (!serverId) return;
    try {
      switch (action) {
        case 'mute':
          if (!payload.channelId) throw new Error(t('channelSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'remove':
          if (!payload.channelId) throw new Error(t('channelSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/remove-from-talk`, {
            method: 'POST',
            body: JSON.stringify({ channelId: payload.channelId }),
          });
          break;
        case 'move':
          if (!payload.channelId || !payload.targetChannelId) throw new Error(t('channelSidebar.errors.missingChannel'));
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/move`, {
            method: 'POST',
            body: JSON.stringify({ fromChannelId: payload.channelId, toChannelId: payload.targetChannelId }),
          });
          break;
        case 'ban':
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}/ban`, { method: 'POST' });
          break;
        case 'kick':
          await apiFetch(`/api/servers/${serverId}/members/${payload.userId}`, { method: 'DELETE' });
          break;
      }
    } catch (err: any) {
      alert(err?.message || t('channelSidebar.errors.actionFailed'));
    } finally {
      closeContextMenu();
      fetchData();
    }
  };

  const reorderChannels = useCallback(
    (parent: string, fromId: number, toId: number) => {
      const previous = { categories, uncategorized };

      if (parent === 'uncategorized') {
        const oldIndex = uncategorized.findIndex((c) => c.id === fromId);
        const newIndex = uncategorized.findIndex((c) => c.id === toId);
        if (oldIndex < 0 || newIndex < 0) return;

        const updatedUncategorized = arrayMove(uncategorized, oldIndex, newIndex);
        setUncategorized(updatedUncategorized);
        persistStructure(categories, updatedUncategorized, previous);
        return;
      }

      const categoryId = Number(parent.replace('category-', ''));
      const categoryIndex = categories.findIndex((cat) => cat.id === categoryId);
      if (categoryIndex < 0) return;

      const oldIndex = categories[categoryIndex].channels.findIndex((c) => c.id === fromId);
      const newIndex = categories[categoryIndex].channels.findIndex((c) => c.id === toId);
      if (oldIndex < 0 || newIndex < 0) return;

      const updatedCategories = categories.map((cat) =>
        cat.id === categoryId ? { ...cat, channels: arrayMove(cat.channels, oldIndex, newIndex) } : cat
      );

      setCategories(updatedCategories);
      persistStructure(updatedCategories, uncategorized, previous);
    },
    [categories, persistStructure, uncategorized]
  );

  const handleUndoReorder = useCallback(() => {
    if (!pendingReorder) return;
    setCategories(pendingReorder.previous.categories);
    setUncategorized(pendingReorder.previous.uncategorized);
    setPendingReorder(null);
    setStructureError(null);
  }, [pendingReorder]);

  const handleRetryReorder = useCallback(() => {
    if (!pendingReorder) return;
    persistStructure(pendingReorder.next.categories, pendingReorder.next.uncategorized, pendingReorder.previous);
  }, [pendingReorder, persistStructure]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (dragDisabled) return;
      const { active, over } = event;
      if (!over) return;
      if (active.id === over.id) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData?.type === 'category' && overData?.type === 'category') {
        const previous = { categories, uncategorized };
        const oldIndex = categories.findIndex((cat) => categoryKey(cat.id) === active.id);
        const newIndex = categories.findIndex((cat) => categoryKey(cat.id) === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const updatedCategories = arrayMove(categories, oldIndex, newIndex);
        setCategories(updatedCategories);
        persistStructure(updatedCategories, uncategorized, previous);
        return;
      }

      if (activeData?.type === 'channel' && overData?.type === 'channel') {
        if (activeData.parent !== overData.parent) return;
        reorderChannels(activeData.parent, activeData.channelId, overData.channelId);
      }
    },
    [categories, dragDisabled, persistStructure, reorderChannels, uncategorized]
  );

  const renderLocalMicLevel = (level: number) => {
    const bars = [0.18, 0.38, 0.58, 0.78];
    const percent = Math.round(level * 100);

    return (
      <div
        className="ml-1 flex items-end gap-[2px]"
        aria-live="polite"
        aria-label={t('channelSidebar.micLevelLabel', { level: percent })}
      >
        <span className="sr-only">{t('channelSidebar.micLevelLabel', { level: percent })}</span>
        {bars.map((threshold) => (
          <div
            key={threshold}
            className="w-1 rounded-full bg-green-400 transition-[height,opacity] duration-150 ease-out"
            style={{
              height: `${4 + Math.max(0, level - threshold) * 26}px`,
              opacity: level >= threshold - 0.05 ? 1 : 0.35,
            }}
            aria-hidden
          />
        ))}
      </div>
    );
  };

  const renderChannel = (
    c: Channel,
    isInside: boolean,
    dragMeta?: {
      handleProps: Record<string, unknown>;
      setNodeRef: (element: HTMLElement | null) => void;
      style: CSSProperties;
      isDragging: boolean;
      isDisabled: boolean;
    }
  ) => {
    if (c.type === 'spacer') {
      return (
        <div key={c.id} className={`${isInside ? 'ml-4' : 'mx-2'} my-2 flex items-center gap-2`}>
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 select-none">
            {t('channelSidebar.separator')}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      );
    }

    const Icon =
      c.type === 'web'
        ? Globe
        : c.type === 'voice'
        ? Volume2
        : c.type === 'data-transfer'
        ? Lock
        : c.type === 'list'
        ? ListChecks
        : Hash;
    
    const isActive = activeChannelId === c.id;
    // Visuelle Indikation: Grüner Text, wenn ICH hier verbunden bin
    const isConnected = c.type === 'voice' && voiceChannelId === c.id && connectionState === 'connected';
    const isVoiceReady = connectionState === 'connected';

    // --- OPTIMISTISCHE TEILNEHMER-LISTE ---
    // Start mit der Liste vom Server
    let displayParticipants = [...(channelPresence[c.id] || [])];
    const localUserId = localUser?.id ? String(localUser.id) : null;

    if (localUserId && c.type === 'voice') {
        const isMeConnectedHere = connectionState === 'connected' && voiceChannelId === c.id;
        const amIInList = displayParticipants.some(u => String(u.id) === localUserId);

        if (isMeConnectedHere && !amIInList) {
            // FIX: Ich bin verbunden, aber der Server hat mich noch nicht geschickt -> Füge mich optimistisch hinzu
            displayParticipants.push({
                id: Number(localUserId),
                username: settings.profile.displayName || localUser.username || t('channelSidebar.selfPlaceholder'),
                avatar_url: settings.profile.avatarUrl || localUser.avatar_url,
                status: 'online'
            });
        } else if (!isMeConnectedHere && amIInList) {
            // FIX: Ich bin NICHT mehr verbunden, aber der Server listet mich noch -> Entferne mich sofort
            displayParticipants = displayParticipants.filter(u => String(u.id) !== localUserId);
        }
    }

    const hasPresence = displayParticipants.length > 0;

    const dragHandleLabel = t('channelSidebar.reorderChannel', { channel: c.name }) ?? `Kanal ${c.name} verschieben`;

    return (
      <div key={c.id} className="relative" ref={dragMeta?.setNodeRef} style={dragMeta?.style}>
        <div
          onClick={() => handleChannelClick(c)}
          role="button"
          tabIndex={0}
          aria-label={t('channelSidebar.channelButtonLabel', { channel: c.name })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleChannelClick(c);
            }
          }}
          className={`flex items-center no-drag px-2 py-1.5 mb-0.5 cursor-pointer group select-none rounded-md transition-colors
            ${isInside ? 'ml-4' : 'mx-2'}
            ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 focus-visible:bg-white/5 focus-visible:text-gray-200'}
            ${dragMeta?.isDragging ? 'opacity-80 ring-1 ring-white/20' : ''}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]
          `}
        >
          {dragMeta && (
            <button
              type="button"
              className={`mr-2 flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-600 hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317] ${dragMeta.isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
              aria-label={dragHandleLabel}
              aria-roledescription="Reorder handle"
              aria-disabled={dragMeta.isDisabled}
              {...dragMeta.handleProps}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          )}
          <Icon size={16} className={`mr-2 ${isConnected ? 'text-green-500' : ''}`} />
          <span className={`text-sm truncate flex-1 font-medium ${isConnected ? 'text-green-400' : ''}`}>{c.name}</span>
        </div>

        {c.type === 'voice' && hasPresence && (
          <div
            className={`${isInside ? 'ml-8' : 'ml-6'} mr-2 mb-1 rounded-md border border-white/5 bg-white/5 px-2 py-1.5 animate-in slide-in-from-top-1 duration-200 transition-all ${isVoiceReady ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
            aria-hidden={!isVoiceReady}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1 font-bold flex items-center gap-1">
              {t('channelSidebar.inChannel')}
            </div>
            <div className="space-y-1">
                {displayParticipants.map((user) => {
                  const isLocalUser = String(user.id) === localUserId;

                  return (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 text-xs text-gray-200 group/user"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openUserMenu({ x: e.clientX, y: e.clientY, target: e.currentTarget as HTMLElement }, user, c);
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches?.[0];
                      startLongPress(() =>
                        openUserMenu(
                          { x: touch?.clientX || 0, y: touch?.clientY || 0, target: e.currentTarget as HTMLElement },
                          user,
                          c
                        )
                      );
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    <div className="relative">
                        {user.avatar_url ? (
                          <img
                              src={user.avatar_url}
                              className="w-4 h-4 rounded-full object-cover"
                              alt={`${user.username || t('channelSidebar.fallbackUser')} Avatar`}
                            />
                        ) : (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${user.status === 'online' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                {user.username?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#1e1f22] ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`font-medium truncate flex-1 ${isLocalUser ? 'text-green-300' : ''}`} title={user.username}>
                        {user.username} {isLocalUser && '(Du)'}
                      </span>
                      {isLocalUser && renderLocalMicLevel(localAudioLevel)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleCategory = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const handleOpenServerSettings = useCallback(() => {
    onOpenServerSettings();
  }, [onOpenServerSettings]);

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {!isDesktop && (
      <div
        className="h-12 flex items-center gap-2 px-4 border-b border-white/5 transition-colors no-drag relative z-10"
        data-no-drag
      >
        <div
          className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer rounded-md px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317] focus-visible:bg-white/5"
          role="button"
          tabIndex={0}
          data-no-drag
          onClick={handleOpenServerSettings}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpenServerSettings();
          }}
          aria-label={t('channelSidebar.openServerSettings', { server: serverName || t('channelSidebar.defaultServerName') })}
          title={t('channelSidebar.openServerSettings', { server: serverName || t('channelSidebar.defaultServerName') })}
        >
          <span className="font-bold text-white truncate flex-1 min-w-0" title={serverName || t('channelSidebar.defaultServerName')}>
            {serverName || t('channelSidebar.defaultServerName')}
          </span>
          <button
            type="button"
            onClick={handleOpenServerSettings}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleOpenServerSettings();
            }}
            className="p-2 flex-shrink-0 rounded-md hover:bg-white/5 text-gray-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
            title={t('channelSidebar.openServerSettings', { server: serverName || t('channelSidebar.defaultServerName') })}
            aria-label={t('channelSidebar.openServerSettings', { server: serverName || t('channelSidebar.defaultServerName') })}
          >
            <Settings size={16} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          className="p-1.5 flex-shrink-0 rounded-md hover:bg-white/10 text-gray-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
          title={t('channelSidebar.createChannel')}
          aria-label={t('channelSidebar.createChannel')}
          data-no-drag
          onClick={(e) => {
            e.stopPropagation();
            setCreateType('text');
            setCreateCategoryId(null);
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} />
        </button>

        {/* Mobile: Close Navigation (wird bewusst im Header gerendert, damit es nicht über dem Zahnrad liegt) */}
        {onCloseMobileNav && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCloseMobileNav();
            }}
            className="lg:hidden p-2 -mr-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
            title={t('channelSidebar.closeNavigation')}
            aria-label={t('channelSidebar.closeNavigation')}
            data-no-drag
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
      )}


        {/* Suche & Liste */}
        <div ref={searchListParentRef} className="flex-1 overflow-y-auto px-2 pb-4 pt-3 custom-scrollbar relative z-0">
          <div className="px-1 mb-3">
            <label className="sr-only" htmlFor="channel-search">
              {t('channelSidebar.searchLabel')}
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" aria-hidden />
              <input
                id="channel-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('channelSidebar.searchPlaceholder') ?? ''}
                className="w-full rounded-md border border-white/10 bg-white/5 px-8 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
          </div>

          {isLoading && (
            <div className="mx-2 mb-4 space-y-3">
              <Spinner label={t('channelSidebar.loading')} />
              <div className="space-y-2">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={`channel-skeleton-${index}`} className="h-9 w-full border border-white/5 bg-white/5" />
                ))}
              </div>
            </div>
          )}

          {error && (
            <ErrorCard
              className="mx-2 mb-3"
              message={error}
              retryLabel={t('channelSidebar.retry') ?? undefined}
              onRetry={() => fetchData()}
            />
          )}

          {structureError && pendingReorder && (
            <div className="mx-2 mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <div className="flex items-start justify-between gap-3">
                <span className="flex-1">{structureError}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
                    onClick={handleUndoReorder}
                  >
                    {t('channelSidebar.undo') ?? 'Rückgängig'}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-amber-50 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
                    onClick={handleRetryReorder}
                  >
                    {t('channelSidebar.retry')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isSavingStructure && (
            <div className="mx-2 mb-3 rounded-md border border-white/5 bg-white/5 px-3 py-2 text-xs text-gray-300">
              {t('channelSidebar.savingOrder') ?? 'Neue Reihenfolge wird gespeichert...'}
            </div>
          )}

          {normalizedSearchTerm ? (
            <div style={{ height: searchVirtualizer.getTotalSize(), position: 'relative' }}>
              {searchVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = virtualizedSearchItems[virtualRow.index];
                if (!row) return null;

                const style: CSSProperties = {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                };

                if (row.type === 'category') {
                  return (
                    <div
                      key={row.key}
                      style={style}
                      className="mt-4 mb-1 flex items-center gap-2 px-1 text-[11px] font-bold uppercase text-gray-500"
                    >
                      <ChevronDown size={10} className="text-gray-600" />
                      {row.category.name}
                    </div>
                  );
                }

                return (
                  <div key={row.key} style={style}>
                    {renderChannel(row.channel, row.parentKey !== 'uncategorized')}
                  </div>
                );
              })}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={filteredUncategorized.map((c) => channelKey(c.id, 'uncategorized'))}
                strategy={verticalListSortingStrategy}
              >
                {filteredUncategorized.map((c) => (
                  <SortableWrapper
                    key={c.id}
                    item={c}
                    id={channelKey(c.id, 'uncategorized')}
                    data={{ type: 'channel', channelId: c.id, parent: 'uncategorized' }}
                    disabled={dragDisabled}
                  >
                    {(dragMeta) => renderChannel(c, false, dragMeta)}
                  </SortableWrapper>
                ))}
              </SortableContext>

              <SortableContext
                items={filteredCategories.map((cat) => categoryKey(cat.id))}
                strategy={verticalListSortingStrategy}
              >
                {filteredCategories.map((cat) => {
                  const isCollapsed = normalizedSearchTerm ? false : collapsed[cat.id];
                  const parentKey = categoryKey(cat.id);

                  return (
                    <SortableWrapper
                      key={cat.id}
                      item={cat}
                      id={parentKey}
                      data={{ type: 'category', categoryId: cat.id }}
                      disabled={dragDisabled}
                    >
                      {(dragMeta) => (
                        <div className={`mt-4 ${dragMeta.isDragging ? 'opacity-80' : ''}`} ref={dragMeta.setNodeRef} style={dragMeta.style}>
                          <div className="flex items-center justify-between group no-drag mb-1 pl-1 pr-2 gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className={`flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-600 hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317] ${dragMeta.isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
                                aria-roledescription="Reorder handle"
                                aria-label={t('channelSidebar.reorderCategory', { category: cat.name }) ?? `Kategorie ${cat.name} verschieben`}
                                aria-disabled={dragMeta.isDisabled}
                                {...dragMeta.handleProps}
                              >
                                <GripVertical size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="flex items-center gap-1 text-gray-500 text-xs font-bold uppercase hover:text-gray-300 rounded-md px-1 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317] focus-visible:text-gray-200"
                                onClick={() => toggleCategory(cat.id)}
                                aria-expanded={!isCollapsed}
                                aria-controls={`category-${cat.id}-channels`}
                                aria-label={t('channelSidebar.toggleCategory', { category: cat.name })}
                                data-no-drag
                              >
                                {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                                {cat.name}
                              </button>
                            </div>
                            <button
                              type="button"
                              className="no-drag p-1 rounded-md text-gray-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
                              title={t('channelSidebar.createChannelInCategory', { category: cat.name })}
                              aria-label={t('channelSidebar.createChannelInCategory', { category: cat.name })}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateType('text');
                                setCreateCategoryId(cat.id);
                                setShowCreateModal(true);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {!isCollapsed && (
                            <SortableContext
                              id={`${parentKey}-context`}
                              items={cat.channels.map((c) => channelKey(c.id, parentKey))}
                              strategy={verticalListSortingStrategy}
                            >
                              <div id={`category-${cat.id}-channels`}>
                                {cat.channels.map((c) => (
                                  <SortableWrapper
                                    key={c.id}
                                    item={c}
                                    id={channelKey(c.id, parentKey)}
                                    data={{ type: 'channel', channelId: c.id, parent: parentKey }}
                                    disabled={dragDisabled}
                                  >
                                    {(channelMeta) => renderChannel(c, true, channelMeta)}
                                  </SortableWrapper>
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </div>
                      )}
                    </SortableWrapper>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {!isLoading && !error && !hasVisibleChannels && (
            <div className="mx-2 mb-3 rounded-md border border-white/5 bg-white/5 px-3 py-2 text-xs text-gray-300">
              {normalizedSearchTerm ? t('channelSidebar.noChannelsFound') : t('channelSidebar.noChannels')}
            </div>
          )}
        </div>

        {contextMenu && (
          <div className="fixed inset-0 z-50" onClick={closeContextMenu}>
            <div
              className="absolute min-w-[240px] rounded-md bg-[#16181d] border border-white/10 shadow-xl p-2 space-y-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[11px] text-gray-400 uppercase tracking-wide px-2 pb-1">{contextMenu.username}</div>
              {permissions.move && contextMenu.channelId ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('mute', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
                >
                  {t('channelSidebar.mute')}
                </button>
              ) : null}
              {permissions.move && contextMenu.channelId ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('remove', { userId: contextMenu.userId, channelId: contextMenu.channelId })}
                >
                  {t('channelSidebar.removeFromTalk')}
                </button>
              ) : null}
              {permissions.move && contextMenu.channelId && voiceChannels.length > 1 ? (
                <div className="px-2 py-1 space-y-1">
                  <div className="text-[11px] text-gray-500">{t('channelSidebar.moveToTalk')}</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 bg-[#0f1115] border border-white/10 rounded px-2 py-1 text-sm text-gray-200"
                      value={contextMenu.moveTargetId || ''}
                      onChange={(e) => setContextMenu((prev) => (prev ? { ...prev, moveTargetId: Number(e.target.value) } : prev))}
                    >
                      {voiceChannels
                        .filter((vc) => vc.id !== contextMenu.channelId)
                        .map((vc) => (
                          <option key={vc.id} value={vc.id}>{vc.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-primary/20 text-primary text-sm hover:bg-primary/30"
                      disabled={!contextMenu.moveTargetId}
                      onClick={() =>
                        performModeration('move', {
                          userId: contextMenu.userId,
                          channelId: contextMenu.channelId!,
                          targetChannelId: contextMenu.moveTargetId ?? null,
                        })
                      }
                    >
                      {t('channelSidebar.move')}
                    </button>
                  </div>
                </div>
              ) : null}
              {permissions.kick ? (
                <>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('ban', { userId: contextMenu.userId })}
                >
                    {t('channelSidebar.ban')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm text-gray-200"
                  onClick={() => performModeration('kick', { userId: contextMenu.userId })}
                >
                    {t('channelSidebar.kick')}
                </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* --- STATUS PANEL (Verbindung) --- */}
        {connectionState === 'connected' && (
          <div className="bg-[#111214] border-t border-b border-white/5 p-2.5 space-y-2 relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col overflow-hidden mr-2">
                <div className="text-green-500 text-[10px] font-bold uppercase flex items-center gap-1.5 mb-0.5">
                  <Mic size={10} className="animate-pulse" /> {t('channelSidebar.connected')}
                </div>
                <div className="text-white text-xs font-bold truncate">{activeChannelName}</div>
                {(cameraError || screenShareError) && (
                  <div className="text-[10px] text-red-400 truncate">{cameraError || screenShareError}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    aria-label={isCameraEnabled ? t('channelSidebar.stopCamera') : t('channelSidebar.startCamera')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCamera().catch(console.error);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleButtonKey(e, () => toggleCamera());
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-colors ${
                      isCameraEnabled
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                    } ${isPublishingCamera ? 'opacity-60 cursor-wait' : ''}`}
                    title={isCameraEnabled ? t('channelSidebar.stopCamera') : t('channelSidebar.startCamera')}
                    disabled={isPublishingCamera}
                  >
                    <Camera size={14} />
                  </button>
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    {isCameraEnabled ? t('channelSidebar.stopCamera') : t('channelSidebar.startCamera')}
                  </div>
                </div>
                <div className="relative group">
                  <button
                    aria-label={isScreenSharing ? t('channelSidebar.stopScreenShare') : t('channelSidebar.startScreenShare')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleScreenShare().catch(console.error);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleButtonKey(e, () => toggleScreenShare());
                    }}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-colors ${
                        isScreenSharing
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                      } ${isPublishingScreen ? 'opacity-60 cursor-wait' : ''}`}
                    title={isScreenSharing ? t('channelSidebar.stopScreenShare') : t('channelSidebar.startScreenShare')}
                    disabled={isPublishingScreen}
                  >
                    <ScreenShare size={14} />
                  </button>
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    {isScreenSharing ? t('channelSidebar.stopScreenShare') : t('channelSidebar.startScreenShare')}
                  </div>
                </div>
                <div className="relative group">
                  <button
                    aria-label={t('channelSidebar.hangUp')}
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnect().catch(console.error);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleButtonKey(e, () => disconnect());
                    }}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    title={t('channelSidebar.hangUp')}
                  >
                    <PhoneOff size={16} aria-hidden />
                  </button>
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    {t('channelSidebar.hangUp')}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">
                {t('channelSidebar.microphone')}
                <select
                  value={selectedAudioInputId || ''}
                  onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">{t('channelSidebar.systemMicrophone')}</option>
                  {audioInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || t('channelSidebar.microphone')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">
                {t('channelSidebar.camera')}
                <select
                  value={selectedVideoInputId || ''}
                  onChange={(e) => handleDeviceChange('videoinput', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">{t('channelSidebar.defaultCamera')}</option>
                  {videoInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || t('channelSidebar.camera')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {shouldShowVoiceParticipants && (
          <div className="relative z-10">
            <VoiceParticipantsPanel />
          </div>
        )}

        <div className="relative z-10">
          <UserBottomBar />
        </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateChannelModal
          serverId={serverId!}
          categoryId={createCategoryId}
          defaultType={createType}
          theme={serverTheme}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
};
