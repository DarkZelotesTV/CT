import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type TopBarSlots = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

type TopBarApi = {
  slots: TopBarSlots;
  setSlots: (slots: TopBarSlots) => void;
  clearSlots: () => void;
};

const TopBarContext = createContext<TopBarApi | null>(null);

export const TopBarProvider = ({ children }: { children: ReactNode }) => {
  const [slots, setSlotsState] = useState<TopBarSlots>({});

  const setSlots = useCallback((next: TopBarSlots) => setSlotsState(next), []);
  const clearSlots = useCallback(() => setSlotsState({}), []);

  const api = useMemo(() => ({ slots, setSlots, clearSlots }), [slots, setSlots, clearSlots]);

  return <TopBarContext.Provider value={api}>{children}</TopBarContext.Provider>;
};

export const useTopBar = () => {
  const ctx = useContext(TopBarContext);
  if (!ctx) throw new Error('useTopBar must be used within <TopBarProvider />');
  return ctx;
};
