export type PinnedServer = {
  instanceUrl: string;
  serverId: number;
  name?: string;
  iconUrl?: string;
  addedAt: string;
};

const STORAGE_KEY = 'ct.pinned_servers.v1';

export function normalizeInstanceUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return withProto.replace(/\/$/, '');
  }
}

export function readPinnedServers(): PinnedServer[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PinnedServer[];
  } catch {
    return [];
  }
}

export function writePinnedServers(list: PinnedServer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addPinnedServer(entry: Omit<PinnedServer, 'addedAt'> & { addedAt?: string }): PinnedServer[] {
  const nextEntry: PinnedServer = {
    ...entry,
    instanceUrl: normalizeInstanceUrl(entry.instanceUrl),
    serverId: Number(entry.serverId),
    addedAt: entry.addedAt || new Date().toISOString(),
  };

  const list = readPinnedServers();
  const filtered = list.filter(
    (s) => !(normalizeInstanceUrl(s.instanceUrl) === nextEntry.instanceUrl && Number(s.serverId) === nextEntry.serverId)
  );

  const next = [nextEntry, ...filtered].slice(0, 50);
  writePinnedServers(next);
  return next;
}

export function removePinnedServer(instanceUrl: string, serverId: number): PinnedServer[] {
  const norm = normalizeInstanceUrl(instanceUrl);
  const list = readPinnedServers();
  const next = list.filter((s) => !(normalizeInstanceUrl(s.instanceUrl) === norm && Number(s.serverId) === Number(serverId)));
  writePinnedServers(next);
  return next;
}
