import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command as CommandIcon, Hash, Search, Server, Users, Volume2 } from 'lucide-react';
import classNames from 'classnames';

import { apiFetch } from '../../api/http';
import type { ApiFetchInit } from '../../api/http';
import { ModalLayout } from './ModalLayout';
import { Icon } from '../ui';
import { Input } from '../ui/Input';

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

    const channelItems = channels.map<PaletteItem>((channel) => {
      const badge = channel.type === 'voice' ? 'Voice' : channel.type === 'web' ? 'Web' : undefined;
      const base: Omit<PaletteItem, 'badge'> & Partial<Pick<PaletteItem, 'badge'>> = {
        id: `channel-${channel.id}`,
        type: 'channel',
        label: channel.name,
        description: serverName ?? 'Channel',
        action: () => onSelectChannel(channel),
      };

      // With `exactOptionalPropertyTypes`, omit optional properties instead of passing `undefined`.
      return badge ? { ...base, badge } : base;
    });

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
    <ModalLayout
      title="Command palette"
      description="Search servers, channels, members, and commands."
      onClose={onClose}
      onOverlayClick={onClose}
      bodyClassName="p-0"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
        <Icon icon={Search} size="lg" tone="muted" aria-hidden="true" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyNavigation}
          placeholder="Search servers, channels, members, commands..."
          className="flex-1 border-0 bg-transparent px-0 text-text placeholder:text-[color:var(--color-text-muted)]"
          aria-label="Command palette search"
        />
        <div className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] rounded-[var(--radius-3)] px-2 py-1 border border-[color:var(--color-border)]" aria-hidden="true">
          Ctrl/Cmd + K
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto" role="listbox" aria-activedescendant={activeId}>
        {loading && <div className="px-4 py-3 text-sm text-[color:var(--color-text-muted)]">Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[color:var(--color-text-muted)]">No results found</div>
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
                    isActive
                      ? 'bg-[color:var(--color-surface-hover)]/80 text-text'
                      : 'hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-text)]'
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectItem(item)}
                >
                  <span className="w-8 h-8 rounded-[var(--radius-3)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] flex items-center justify-center text-[color:var(--color-text)]">
                    {item.type === 'command' && <Icon icon={CommandIcon} size="md" tone="default" className="text-inherit" />}
                    {item.type === 'server' && <Icon icon={Server} size="md" tone="default" className="text-inherit" />}
                    {item.type === 'channel' && (item.badge === 'Voice' ? (
                      <Icon icon={Volume2} size="md" tone="default" className="text-inherit" />
                    ) : (
                      <Icon icon={Hash} size="md" tone="default" className="text-inherit" />
                    ))}
                    {item.type === 'member' && <Icon icon={Users} size="md" tone="default" className="text-inherit" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{item.label}</div>
                    <div className="text-xs text-[color:var(--color-text-muted)] truncate">{item.description}</div>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-text-muted)] border border-[color:var(--color-border)] rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalLayout>
  );
};
