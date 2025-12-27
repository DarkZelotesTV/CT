import { useCallback, useMemo, useState } from 'react';

export type LogCategory = 'system' | 'voice' | 'chat';

export interface LogEntry {
  id: string;
  category: LogCategory;
  message: string;
  createdAt: number;
  meta?: string;
}

const MAX_ENTRIES = 200;

const createId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const useLogStore = () => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');

  const addEntry = useCallback((entry: Omit<LogEntry, 'id' | 'createdAt'> & Partial<Pick<LogEntry, 'createdAt'>>) => {
    setEntries((prev) => {
      const next = [
        ...prev,
        {
          id: createId(),
          createdAt: entry.createdAt ?? Date.now(),
          ...entry,
        },
      ];
      return next.slice(-MAX_ENTRIES);
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const filteredEntries = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.category === filter)),
    [entries, filter]
  );

  return useMemo(
    () => ({
      entries,
      filteredEntries,
      addEntry,
      clear,
      filter,
      setFilter,
    }),
    [addEntry, clear, entries, filteredEntries, filter, setFilter]
  );
};
