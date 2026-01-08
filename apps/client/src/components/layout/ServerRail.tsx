import type React from 'react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Home, Plus, Globe, X, Pin, PinOff, Pencil, Trash2, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api/http';
import { getServerUrl, setServerUrl } from '../../utils/apiConfig';
import { readPinnedServers, removePinnedServer, normalizeInstanceUrl } from '../../utils/pinnedServers';
import { storage } from '../../shared/config/storage';
import { ErrorCard, Spinner } from '../ui';
import { useSocket } from '../../context/SocketContext';

// Props erweitert: onCreateServer und onJoinServer hinzugefügt
interface ServerRailProps {
  selectedServerId: number | null;
  onSelectServer: (id: number | null) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
}

interface Server {
  id: number;
  name: string;
  icon_url?: string;
  unread_count?: number;
  unreadCount?: number;
}

export const ServerRail = ({ selectedServerId, onSelectServer, onCreateServer, onJoinServer }: ServerRailProps) => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<Server[]>([]);
  // Lokale Modals entfernt - werden jetzt von MainLayout gesteuert
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinnedTick, setPinnedTick] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [serverOrder, setServerOrder] = useState<number[]>(() => storage.get('serverRailOrder'));
  const [pinnedLocalIds, setPinnedLocalIds] = useState<number[]>(() => storage.get('serverRailPinned'));
  const [serverAliases, setServerAliases] = useState<Record<number, string>>(() => storage.get('serverRailAliases'));
  const [contextMenu, setContextMenu] = useState<{
    serverId: number;
    type: 'local' | 'remote';
    instanceUrl?: string;
    x: number;
    y: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const { socket } = useSocket();

  const pinned = useMemo(() => {
    // tick forces recompute after mutations
    void pinnedTick;
    return readPinnedServers();
  }, [pinnedTick]);

  // Keep this reactive: in multi-instance setups the user can switch instances.
  const currentInstance = normalizeInstanceUrl(getServerUrl());

  const pinnedRemote = useMemo(
    () => pinned.filter((p) => normalizeInstanceUrl(p.instanceUrl) !== currentInstance),
    [pinned, currentInstance]
  );

  const orderedServers = useMemo(() => {
    const knownOrder = serverOrder.filter((id) => servers.some((s) => s.id === id));
    const missing = servers.map((s) => s.id).filter((id) => !knownOrder.includes(id));
    const fullOrder = [...knownOrder, ...missing];

    const pinnedSet = new Set(pinnedLocalIds);
    const byId = Object.fromEntries(servers.map((s) => [s.id, s]));

    return fullOrder
      .map((id) => byId[id])
      .filter((s): s is Server => Boolean(s))
      .sort((a, b) => {
        const aPinned = pinnedSet.has(a.id);
        const bPinned = pinnedSet.has(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return fullOrder.indexOf(a.id) - fullOrder.indexOf(b.id);
      });
  }, [pinnedLocalIds, serverOrder, servers]);

  const resolveIconUrl = useCallback((iconUrl?: string, instanceUrl?: string) => {
    if (!iconUrl) return '';
    if (/^https?:\/\//i.test(iconUrl)) return iconUrl;
    const base = (instanceUrl && normalizeInstanceUrl(instanceUrl)) || getServerUrl();
    const normalized = iconUrl.startsWith('/') ? iconUrl : `/${iconUrl}`;
    return `${base}${normalized}`;
  }, []);

  const persistOrder = useCallback((next: number[]) => {
    setServerOrder(next);
    storage.set('serverRailOrder', next);
  }, []);

  const togglePinned = useCallback((serverId: number) => {
    setPinnedLocalIds((prev) => {
      const exists = prev.includes(serverId);
      const next = exists ? prev.filter((id) => id !== serverId) : [...prev, serverId];
      storage.set('serverRailPinned', next);
      return next;
    });
  }, []);

  const renameServer = useCallback((serverId: number) => {
    const current = serverAliases[serverId] ?? servers.find((s) => s.id === serverId)?.name ?? '';
    const next = window.prompt(t('serverRail.renamePrompt'), current);
    if (next === null) return;
    setServerAliases((prev) => {
      const updated = { ...prev };
      if (!next.trim()) {
        delete updated[serverId];
      } else {
        updated[serverId] = next.trim();
      }
      storage.set('serverRailAliases', updated);
      return updated;
    });
  }, [serverAliases, servers, t]);

  const displayName = useCallback((server: Server) => serverAliases[server.id] ?? server.name, [serverAliases]);

  const applyUnreadFromServers = useCallback((list: Server[]) => {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      list.forEach((srv) => {
        const count = srv.unreadCount ?? srv.unread_count;
        if (typeof count === 'number' && !Number.isNaN(count)) {
          next[srv.id] = count;
        }
      });
      return next;
    });
  }, []);

  const reorderServers = useCallback(
    (sourceId: number, targetId: number) => {
      if (sourceId === targetId) return;
      const currentOrder = orderedServers.map((s) => s.id);
      const sourceIndex = currentOrder.indexOf(sourceId);
      const targetIndex = currentOrder.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const next = [...currentOrder];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      persistOrder(next);
    },
    [orderedServers, persistOrder]
  );

  const handleContextMenu = (
    event: React.MouseEvent,
    serverId: number,
    type: 'local' | 'remote',
    instanceUrl?: string
  ) => {
    event.preventDefault();
    // With `exactOptionalPropertyTypes`, optional props must be omitted (not set to `undefined`).
    setContextMenu({
      serverId,
      type,
      x: event.clientX,
      y: event.clientY,
      ...(instanceUrl ? { instanceUrl } : {}),
    });
  };

  const handleKeyboardContext = (
    event: React.KeyboardEvent,
    serverId: number,
    type: 'local' | 'remote',
    instanceUrl?: string
  ) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const el = event.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      setContextMenu({
        serverId,
        type,
        x,
        y,
        ...(instanceUrl ? { instanceUrl } : {}),
      });
    }
  };

  const handleDragStart = (serverId: number) => setDraggingId(serverId);
  const handleDragEnd = () => setDraggingId(null);
  const handleDropOn = (targetId: number) => {
    if (draggingId === null) return;
    reorderServers(draggingId, targetId);
    setDraggingId(null);
  };

  const renamePinnedServer = useCallback(
    (serverId: number, instanceUrl?: string) => {
      const list = readPinnedServers();
      const target = list.find(
        (p) =>
          Number(p.serverId) === Number(serverId) &&
          (!instanceUrl || normalizeInstanceUrl(p.instanceUrl) === normalizeInstanceUrl(instanceUrl))
      );

      const fallback = target?.name ?? `Server ${serverId}`;
      const next = window.prompt(t('serverRail.renamePrompt'), fallback);
      if (next === null) return;
      const trimmed = next.trim();
      const updated = list.map((p) =>
        Number(p.serverId) === Number(serverId) && (!instanceUrl || normalizeInstanceUrl(p.instanceUrl) === normalizeInstanceUrl(instanceUrl))
          ? { ...p, name: trimmed || undefined }
          : p
      );
      storage.set('pinnedServers', updated);
      setPinnedTick((x) => x + 1);
    },
    [t]
  );

  const handleContextAction = useCallback(
    (action: 'rename' | 'pin-toggle' | 'remove') => {
      if (!contextMenu) return;
      const { serverId, type, instanceUrl } = contextMenu;
      if (action === 'rename') {
        if (type === 'local') renameServer(serverId);
        else renamePinnedServer(serverId, instanceUrl);
      }

      if (action === 'pin-toggle' && type === 'local') {
        togglePinned(serverId);
      }

      if (action === 'remove' && type === 'remote' && instanceUrl) {
        removePinnedServer(instanceUrl, serverId);
        setPinnedTick((x) => x + 1);
      }

      setContextMenu(null);
    },
    [contextMenu, renamePinnedServer, renameServer, togglePinned]
  );

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Server[]>(`/api/servers`);
      setServers(res);
      applyUnreadFromServers(res);
      setServerOrder((prev) => {
        const filtered = prev.filter((id) => res.some((srv) => srv.id === id));
        const missing = res.map((srv) => srv.id).filter((id) => !filtered.includes(id));
        const next = [...filtered, ...missing];
        storage.set('serverRailOrder', next);
        return next;
      });
      setLastError(null);
    } catch (err) {
      console.error(err);
      setLastError(t('serverRail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [applyUnreadFromServers, t]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await apiFetch<Record<number, number>>(`/api/servers/unread-counts`);
      if (res && typeof res === 'object') {
        setUnreadCounts(res);
      }
    } catch (err) {
      console.debug('Could not load unread counts', err);
    }
  }, []);

  useEffect(() => {
    const handleServersChanged = () => {
      fetchServers();
    };

    window.addEventListener('ct-servers-changed', handleServersChanged);
    return () => {
      window.removeEventListener('ct-servers-changed', handleServersChanged);
    };
  }, [fetchServers]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if (!socket) return;

    const handleUnread = (payload: Record<number, number> | { serverId: number; count: number }) => {
      if (!payload) return;
      if ('serverId' in payload && typeof payload.serverId === 'number') {
        setUnreadCounts((prev) => ({ ...prev, [payload.serverId]: Number(payload.count) || 0 }));
        return;
      }
      setUnreadCounts((prev) => ({ ...prev, ...(payload as Record<number, number>) }));
    };

    socket.on('server_unread', handleUnread);
    socket.on('server_unread_counts', handleUnread);

    return () => {
      socket.off('server_unread', handleUnread);
      socket.off('server_unread_counts', handleUnread);
    };
  }, [socket]);

  useEffect(() => {
    if (!contextMenu) return;

    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-server-menu]')) return;
      setContextMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const blurHandler = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', blurHandler);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('blur', blurHandler);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  // Close the add menu on outside click / ESC
  useEffect(() => {
    if (!showAddMenu) return;

    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-rail-add]')) setShowAddMenu(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddMenu(false);
    };

    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [showAddMenu]);

  const openPinned = (instanceUrl: string, serverId: number) => {
    const norm = normalizeInstanceUrl(instanceUrl);
    if (norm === normalizeInstanceUrl(getServerUrl())) {
      onSelectServer(serverId);
      return;
    }
    storage.set('pendingServerId', serverId);
    setServerUrl(norm);
    window.location.reload();
  };

  return (
    <>
      {/* Container ohne overflow-hidden, damit das Menü sichtbar ist */}
      <div className="w-full h-full flex flex-col relative no-drag">
        
        {/* 1. SCROLLABLE BEREICH: Server Liste */}
        <div className="flex-1 w-full flex flex-col items-center gap-3.5 py-4 px-2 overflow-y-auto no-scrollbar">
          {/* HOME BUTTON */}
          <button
            type="button"
            onClick={() => onSelectServer(null)}
            className={
              `
              w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 group relative no-drag border border-[color:var(--color-border)]
              ${selectedServerId === null
                ? 'bg-emerald-500 text-white rounded-[14px] shadow-[0_0_0_6px_rgba(16,185,129,0.16)] shadow-emerald-500/40'
                : 'bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 text-[color:var(--color-text)] rounded-full hover:rounded-[14px] hover:shadow-[0_0_0_6px_rgba(255,255,255,0.06)]'}
            `
            }
            aria-label="Home"
          >
            <Home size={22} />
          </button>

          <div className="w-10 h-px bg-[color:var(--color-surface-hover)]/80 rounded-full flex-shrink-0" />

          {/* LOCAL SERVERS */}
          {loading && <Spinner label={t('serverRail.loading')} className="text-[color:var(--color-text-muted)]" />}
          {lastError && (
            <ErrorCard
              size="compact"
              className="w-[calc(100%-10px)]"
              message={lastError}
              retryLabel={t('serverRail.retry') ?? undefined}
              onRetry={fetchServers}
            />
          )}
          {!loading && servers.length === 0 && !lastError && (
            <div className="text-xs text-[color:var(--color-text-muted)]">{t('serverRail.empty')}</div>
          )}
          {orderedServers.map((server) => {
            const name = displayName(server);
            const tooltip = name === server.name ? name : `${name} (${server.name})`;
            const unread = unreadCounts[server.id] ?? 0;
            const isPinned = pinnedLocalIds.includes(server.id);

            return (
              <button
                key={`local-${server.id}`}
                type="button"
                onClick={() => onSelectServer(server.id)}
                className={
                  `
                w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 relative group no-drag border border-[color:var(--color-border)]
                ${selectedServerId === server.id ? 'rounded-[14px]' : 'rounded-full hover:rounded-[14px]'}
                bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 hover:shadow-[0_0_0_6px_rgba(255,255,255,0.05)] ${selectedServerId === server.id ? 'shadow-[0_0_0_6px_rgba(16,185,129,0.16)] shadow-emerald-500/40' : ''}
              `
                }
                title={tooltip}
                aria-label={`Server ${name}`}
                draggable
                aria-grabbed={draggingId === server.id}
                onDragStart={() => handleDragStart(server.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOn(server.id);
                }}
                onContextMenu={(e) => handleContextMenu(e, server.id, 'local')}
                onKeyDown={(e) => handleKeyboardContext(e, server.id, 'local')}
              >
                <div
                  className={`absolute left-[-12px] w-1 bg-white rounded-r-full transition-all duration-300
                  ${selectedServerId === server.id ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-50 group-hover:h-4'}
                `}
                />

                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 bg-rose-500 text-[10px] leading-none text-white rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-lg">
                    <Bell size={10} />
                    <span className="font-semibold">{unread > 99 ? '99+' : unread}</span>
                  </div>
                )}

                {isPinned && (
                  <div className="absolute -bottom-2 text-[10px] text-indigo-300" aria-hidden>
                    <Pin size={12} />
                  </div>
                )}

                {server.icon_url ? (
                  <img
                    src={resolveIconUrl(server.icon_url)}
                    alt={name}
                    className={`w-full h-full object-cover transition-all ${selectedServerId === server.id ? 'rounded-[14px]' : 'rounded-full group-hover:rounded-[14px]'}`}
                  />
                ) : (
                  <span className="text-[color:var(--color-text)] font-bold text-sm group-hover:text-white transition-colors">
                    {name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}

          {/* REMOTE / PINNED SERVERS */}
          {pinnedRemote.length > 0 && (
            <>
              <div className="w-8 h-[2px] bg-[color:var(--color-surface-hover)] rounded-full flex-shrink-0" />
              {pinnedRemote.map((p) => (
                <div
                  key={`remote-${p.instanceUrl}-${p.serverId}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPinned(p.instanceUrl, p.serverId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      openPinned(p.instanceUrl, p.serverId);
                      return;
                    }
                    handleKeyboardContext(e, p.serverId, 'remote', p.instanceUrl);
                  }}
                  className="no-drag w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 relative group no-drag rounded-full hover:rounded-[14px] bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 outline-none border border-[color:var(--color-border)] hover:shadow-[0_0_0_6px_rgba(255,255,255,0.06)]"
                  title={`${p.name ?? `Server ${p.serverId}`} (${p.instanceUrl})`}
                  onContextMenu={(e) => handleContextMenu(e, p.serverId, 'remote', p.instanceUrl)}
                >
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[color:var(--color-surface)]/90 border border-[color:var(--color-border)] flex items-center justify-center text-cyan-300">
                    <Globe size={12} />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePinnedServer(p.instanceUrl, p.serverId);
                      setPinnedTick((x) => x + 1);
                    }}
                    className="no-drag absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[color:var(--color-surface)]/90 border border-[color:var(--color-border)] hidden group-hover:flex items-center justify-center text-[color:var(--color-text)] hover:text-white"
                    title="Entfernen"
                    aria-label="Server entfernen"
                  >
                    <X size={12} />
                  </button>

                  {p.iconUrl ? (
                    <img
                      src={resolveIconUrl(p.iconUrl, p.instanceUrl)}
                      alt={p.name ?? 'Remote'}
                      className="w-full h-full object-cover transition-all rounded-full group-hover:rounded-[14px]"
                    />
                  ) : (
                    <span className="text-[color:var(--color-text)] font-bold text-sm group-hover:text-white transition-colors">
                      {(p.name ?? `S${p.serverId}`).substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 2. FIXIERTER FOOTER: Add Button + Menü */}
        <div className="flex-shrink-0 w-full flex flex-col items-center pb-4 relative z-50">
          <div className="relative" data-rail-add>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowAddMenu((v) => !v)}
              className="no-drag w-12 h-12 flex-shrink-0 no-drag rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center cursor-pointer text-emerald-300 transition-all duration-300 hover:rounded-[14px] hover:shadow-[0_0_0_6px_rgba(16,185,129,0.16)] group"
              title="Server hinzufügen"
              aria-label="Server hinzufügen"
            >
              <Plus size={22} className="group-hover:text-white" />
            </button>

            {showAddMenu && (
              <div className="absolute left-16 bottom-0 w-52 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-[var(--radius-3)] shadow-2xl p-2 z-50 no-drag">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-[var(--radius-2)] hover:bg-[color:var(--color-surface-hover)] text-sm text-white"
                  onClick={() => {
                    setShowAddMenu(false);
                    onCreateServer(); // Ruft jetzt die Prop auf
                  }}
                >
                  Server erstellen
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-[var(--radius-2)] hover:bg-[color:var(--color-surface-hover)] text-sm text-white"
                  onClick={() => {
                    setShowAddMenu(false);
                    onJoinServer(); // Ruft jetzt die Prop auf
                  }}
                >
                  Server beitreten / hinzufügen
                </button>
                <div className="text-[10px] text-[color:var(--color-text-muted)] px-3 pt-2 pb-1">Aktuelle Instanz: {currentInstance}</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {contextMenu && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            role="menu"
            tabIndex={-1}
            data-server-menu
            aria-label={t('serverRail.contextMenuAria') ?? 'Server Menü'}
            className="pointer-events-auto absolute min-w-[180px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-[var(--radius-3)] shadow-2xl p-2 text-sm text-white"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 rounded-[var(--radius-2)] hover:bg-[color:var(--color-surface-hover)] focus:bg-[color:var(--color-surface-hover)]/80 focus:outline-none"
              onClick={() => handleContextAction('rename')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleContextAction('rename');
                }
              }}
            >
              <Pencil size={16} />
              <span>{t('serverRail.context.rename')}</span>
            </button>

            {contextMenu.type === 'local' && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 rounded-[var(--radius-2)] hover:bg-[color:var(--color-surface-hover)] focus:bg-[color:var(--color-surface-hover)]/80 focus:outline-none"
                onClick={() => handleContextAction('pin-toggle')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleContextAction('pin-toggle');
                  }
                }}
              >
                {pinnedLocalIds.includes(contextMenu.serverId) ? <PinOff size={16} /> : <Pin size={16} />}
                <span>
                  {pinnedLocalIds.includes(contextMenu.serverId)
                    ? t('serverRail.context.unpin')
                    : t('serverRail.context.pin')}
                </span>
              </button>
            )}

            {contextMenu.type === 'remote' && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 rounded-[var(--radius-2)] hover:bg-[color:var(--color-surface-hover)] focus:bg-[color:var(--color-surface-hover)]/80 focus:outline-none"
                onClick={() => handleContextAction('remove')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleContextAction('remove');
                  }
                }}
              >
                <Trash2 size={16} />
                <span>{t('serverRail.context.remove')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals wurden hier entfernt und befinden sich nun in MainLayout */}
    </>
  );
};
