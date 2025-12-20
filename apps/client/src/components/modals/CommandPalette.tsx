import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command as CommandIcon, Hash, Search, Server, Users, Volume2 } from 'lucide-react';
import classNames from 'classnames';

import { apiFetch } from '../../api/http';
import type { ApiFetchInit } from '../../api/http';

interface PaletteServer {
  id: number;
  name: string;
  icon_url?: string;
}

interface PaletteChannel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
}

interface PaletteMember {
  userId: number;
  username: string;
}

interface PaletteProps {
  open: boolean;
  serverId: number | null;
  serverName?: string;
  onClose: () => void;
  onSelectServer: (serverId: number | null) => void;
  onSelectChannel: (channel: PaletteChannel) => void;
  onShowMembers: () => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onOpenServerSettings: () => void;
}

interface PaletteItem {
  id: string;
  type: 'server' | 'channel' | 'member' | 'command';
  label: string;
  description?: string;
  badge?: string;
  action: () => void | Promise<void>;
}

interface StructureResponse {
  categories: { id: number; name: string; channels: PaletteChannel[] }[];
  uncategorized: PaletteChannel[];
}

const normalizeMember = (member: any): PaletteMember => ({
  userId: member.userId ?? member.user_id ?? member.User?.id ?? member.user?.id,
  username: member.username ?? member.User?.username ?? member.user?.username ?? 'Unknown user',
});

export const CommandPalette = ({
  open,
  serverId,
  serverName,
  onClose,
  onSelectServer,
  onSelectChannel,
  onShowMembers,
  onCreateServer,
  onJoinServer,
  onOpenServerSettings,
}: PaletteProps) => {
  const [servers, setServers] = useState<PaletteServer[]>([]);
  const [channels, setChannels] = useState<PaletteChannel[]>([]);
  const [members, setMembers] = useState<PaletteMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchSafe = useCallback(
    async <T,>(path: string, init?: ApiFetchInit): Promise<T | null> => {
      try {
        return await apiFetch<T>(path, init);
      } catch (error) {
        console.error('Command palette request failed', error);
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timeout = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const serverList = await fetchSafe<PaletteServer[]>('/api/servers');
      if (cancelled) return;
      if (serverList) {
        setServers(serverList);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchSafe, open]);

  useEffect(() => {
    if (!open || !serverId) {
      setChannels([]);
      setMembers([]);
      return;
    }

    let cancelled = false;

    const loadServerData = async () => {
      setLoading(true);
      const [structure, memberList] = await Promise.all([
        fetchSafe<StructureResponse>(`/api/servers/${serverId}/structure`),
        fetchSafe<any[]>(`/api/servers/${serverId}/members`),
      ]);

      if (cancelled) return;

      if (structure) {
        const normalized = [
          ...(structure.uncategorized || []),
          ...structure.categories.flatMap((category) => category.channels || []),
        ].filter((channel) => channel.type !== 'spacer' && channel.type !== 'list');
        setChannels(normalized);
      }

      if (memberList) {
        setMembers(memberList.map(normalizeMember));
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    loadServerData();
    return () => {
      cancelled = true;
    };
  }, [fetchSafe, open, serverId]);

  const items = useMemo<PaletteItem[]>(() => {
    const commandItems: PaletteItem[] = [
      {
        id: 'command-create-server',
        type: 'command',
        label: 'Create server',
        description: 'Start a new server',
        action: onCreateServer,
      },
      {
        id: 'command-join-server',
        type: 'command',
        label: 'Join server',
        description: 'Connect to an existing server',
        action: onJoinServer,
      },
    ];

    if (serverId) {
      commandItems.push({
        id: 'command-server-settings',
        type: 'command',
        label: 'Open server settings',
        description: 'Configure the current server',
        action: onOpenServerSettings,
      });
    }

    const serverItems = servers.map<PaletteItem>((server) => ({
      id: `server-${server.id}`,
      type: 'server',
      label: server.name,
      description: 'Server',
      action: () => onSelectServer(server.id),
    }));

    const channelItems = channels.map<PaletteItem>((channel) => ({
      id: `channel-${channel.id}`,
      type: 'channel',
      label: channel.name,
      description: serverName ?? 'Channel',
      badge: channel.type === 'voice' ? 'Voice' : channel.type === 'web' ? 'Web' : undefined,
      action: () => onSelectChannel(channel),
    }));

    const memberItems = members.map<PaletteItem>((member) => ({
      id: `member-${member.userId}`,
      type: 'member',
      label: member.username,
      description: serverName ?? 'Member',
      action: onShowMembers,
    }));

    return [...commandItems, ...serverItems, ...channelItems, ...memberItems];
  }, [channels, members, onCreateServer, onJoinServer, onOpenServerSettings, onSelectChannel, onSelectServer, onShowMembers, serverId, serverName, servers]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.label, item.description, item.badge]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    );
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  useEffect(() => {
    const active = filtered[activeIndex];
    if (!active) return;
    const element = optionRefs.current[active.id];
    element?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered]);

  const handleKeyNavigation = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filtered.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) selectItem(item);
    }

    if (event.key === 'Escape') {
      onClose();
    }
  };

  const selectItem = useCallback(
    async (item: PaletteItem) => {
      await Promise.resolve(item.action());
      onClose();
    },
    [onClose]
  );

  if (!open) return null;

  const activeId = filtered[activeIndex]?.id;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden" role="document">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
          <Search size={18} className="text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Search servers, channels, members, commands..."
            className="flex-1 bg-transparent outline-none text-white placeholder:text-gray-500"
            aria-label="Command palette search"
          />
          <div className="text-xs text-gray-500 bg-white/5 rounded-md px-2 py-1 border border-white/10" aria-hidden="true">
            Ctrl/Cmd + K
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto" role="listbox" aria-activedescendant={activeId}>
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">Loading...</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No results found</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <div
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={isActive}
                    ref={(node) => {
                      optionRefs.current[item.id] = node;
                    }}
                    className={classNames(
                      'px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors',
                      isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-200'
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                  >
                    <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                      {item.type === 'command' && <CommandIcon size={16} />}
                      {item.type === 'server' && <Server size={16} />}
                      {item.type === 'channel' && (item.badge === 'Voice' ? <Volume2 size={16} /> : <Hash size={16} />)}
                      {item.type === 'member' && <Users size={16} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{item.label}</div>
                      <div className="text-xs text-gray-400 truncate">{item.description}</div>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-white/10 rounded-full px-2 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
