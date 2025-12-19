import { useMemo, useState, useEffect, useCallback } from 'react';
import { Home, Plus, Loader2, Globe, X } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { getServerUrl, setServerUrl } from '../../utils/apiConfig';
import { readPinnedServers, removePinnedServer, normalizeInstanceUrl } from '../../utils/pinnedServers';

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
}

export const ServerRail = ({ selectedServerId, onSelectServer, onCreateServer, onJoinServer }: ServerRailProps) => {
  const [servers, setServers] = useState<Server[]>([]);
  // Lokale Modals entfernt - werden jetzt von MainLayout gesteuert
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinnedTick, setPinnedTick] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

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

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Server[]>(`/api/servers`);
      setServers(res);
      setLastError(null);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to load servers';
      setLastError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    const handleServersChanged = () => {
      fetchServers();
    };

    window.addEventListener('ct-servers-changed', handleServersChanged);
    return () => {
      window.removeEventListener('ct-servers-changed', handleServersChanged);
    };
  }, [fetchServers]);

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
    localStorage.setItem('ct.pending_server_id', String(serverId));
    setServerUrl(norm);
    window.location.reload();
  };

  return (
    <>
      {/* Container ohne overflow-hidden, damit das Menü sichtbar ist */}
      <div className="w-full h-full flex flex-col relative no-drag">
        
        {/* 1. SCROLLABLE BEREICH: Server Liste */}
        <div className="flex-1 w-full flex flex-col items-center gap-4 py-4 overflow-y-auto no-scrollbar">
          {/* HOME BUTTON */}
          <button
            type="button"
            onClick={() => onSelectServer(null)}
            className={
              `
              w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 group relative no-drag
              ${selectedServerId === null
                ? 'bg-indigo-500 rounded-[16px] shadow-lg shadow-indigo-500/20 text-white'
                : 'bg-white/5 hover:bg-indigo-500 hover:text-white text-gray-400 rounded-[24px] hover:rounded-[16px]'}
            `
            }
            aria-label="Home"
          >
            <Home size={22} />
          </button>

          <div className="w-8 h-[2px] bg-white/5 rounded-full flex-shrink-0" />

          {/* LOCAL SERVERS */}
          {loading && <Loader2 className="animate-spin text-gray-600" />}
          {lastError && (
            <button
              type="button"
              onClick={fetchServers}
              className="text-xs text-red-200 bg-red-500/10 border border-red-500/40 rounded-full px-3 py-1 hover:bg-red-500/20 transition-colors"
              title="Erneut versuchen"
            >
              !
            </button>
          )}
          {!loading && servers.length === 0 && !lastError && (
            <div className="text-xs text-gray-400">Noch keine Server</div>
          )}
          {servers.map((server) => (
            <button
              key={`local-${server.id}`}
              type="button"
              onClick={() => onSelectServer(server.id)}
              className={
                `
                w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 relative group no-drag
                ${selectedServerId === server.id ? 'rounded-[16px]' : 'rounded-[24px] hover:rounded-[16px]'}
                bg-white/5 hover:bg-white/10
              `
              }
              title={server.name}
              aria-label={`Server ${server.name}`}
            >
              <div
                className={`absolute left-[-12px] w-1 bg-white rounded-r-full transition-all duration-300
                  ${selectedServerId === server.id ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-50 group-hover:h-4'}
                `}
              />

              {server.icon_url ? (
                <img
                  src={server.icon_url}
                  alt={server.name}
                  className={`w-full h-full object-cover transition-all ${selectedServerId === server.id ? 'rounded-[16px]' : 'rounded-[24px] group-hover:rounded-[16px]'}`}
                />
              ) : (
                <span className="text-gray-200 font-bold text-sm group-hover:text-white transition-colors">
                  {server.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </button>
          ))}

          {/* REMOTE / PINNED SERVERS */}
          {pinnedRemote.length > 0 && (
            <>
              <div className="w-8 h-[2px] bg-white/5 rounded-full flex-shrink-0" />
              {pinnedRemote.map((p) => (
                <div
                  key={`remote-${p.instanceUrl}-${p.serverId}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPinned(p.instanceUrl, p.serverId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openPinned(p.instanceUrl, p.serverId);
                  }}
                  className="no-drag w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 relative group no-drag rounded-[24px] hover:rounded-[16px] bg-white/5 hover:bg-white/10 outline-none"
                  title={`${p.name ?? `Server ${p.serverId}`} (${p.instanceUrl})`}
                >
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-cyan-300">
                    <Globe size={12} />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePinnedServer(p.instanceUrl, p.serverId);
                      setPinnedTick((x) => x + 1);
                    }}
                    className="no-drag absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black/70 border border-white/10 hidden group-hover:flex items-center justify-center text-gray-300 hover:text-white"
                    title="Entfernen"
                    aria-label="Server entfernen"
                  >
                    <X size={12} />
                  </button>

                  {p.iconUrl ? (
                    <img
                      src={p.iconUrl}
                      alt={p.name ?? 'Remote'}
                      className="w-full h-full object-cover transition-all rounded-[24px] group-hover:rounded-[16px]"
                    />
                  ) : (
                    <span className="text-gray-200 font-bold text-sm group-hover:text-white transition-colors">
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
              className="no-drag w-12 h-12 flex-shrink-0 no-drag rounded-[24px] bg-white/5 hover:bg-green-500/20 flex items-center justify-center cursor-pointer text-green-500 transition-all duration-300 hover:rounded-[16px] group"
              title="Server hinzufügen"
              aria-label="Server hinzufügen"
            >
              <Plus size={22} className="group-hover:text-green-400" />
            </button>

            {showAddMenu && (
              <div className="absolute left-16 bottom-0 w-52 bg-[#0f1014] border border-white/10 rounded-xl shadow-2xl p-2 z-50 no-drag">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white"
                  onClick={() => {
                    setShowAddMenu(false);
                    onCreateServer(); // Ruft jetzt die Prop auf
                  }}
                >
                  Server erstellen
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white"
                  onClick={() => {
                    setShowAddMenu(false);
                    onJoinServer(); // Ruft jetzt die Prop auf
                  }}
                >
                  Server beitreten / hinzufügen
                </button>
                <div className="text-[10px] text-gray-500 px-3 pt-2 pb-1">Aktuelle Instanz: {currentInstance}</div>
              </div>
            )}
          </div>
        </div>

      </div>
      
      {/* Modals wurden hier entfernt und befinden sich nun in MainLayout */}
    </>
  );
};