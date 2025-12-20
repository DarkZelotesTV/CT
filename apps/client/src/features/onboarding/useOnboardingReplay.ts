import { useCallback, useState } from 'react';
import { storage, type OnboardingReplayState } from '../../shared/config/storage';

export type OnboardingReplayKey = keyof OnboardingReplayState;

export const useOnboardingReplay = () => {
  const [state, setState] = useState<OnboardingReplayState>(() => storage.get('onboardingReplays'));

  const markReplaySeen = useCallback((key?: OnboardingReplayKey) => {
    if (!key) return;
    setState((previous) => {
      if (previous[key]) return previous;
      const next = { ...previous, [key]: true } satisfies OnboardingReplayState;
      storage.set('onboardingReplays', next);
      return next;
    });
  }, []);

  const shouldShowReplay = useCallback((key: OnboardingReplayKey) => !state[key], [state]);

  return { replayState: state, shouldShowReplay, markReplaySeen };
};
