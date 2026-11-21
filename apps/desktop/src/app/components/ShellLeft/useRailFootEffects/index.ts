import { useEffect, useRef, type RefObject } from 'react';
import { hydrateOnboardingFromDb } from '../../../../features/onboarding/onboardingSettings';
import { useRestartWhenIdle } from '../../../../features/updater/hooks/useRestartWhenIdle';
import { useIsMainWindow } from '../../../../features/workspace/useIsMainWindow';

type Params = Record<never, never>;

type RailFootEffects = {
  readonly anchorRef: RefObject<HTMLDivElement | null>;
};

export const useRailFootEffects = ({}: Params): RailFootEffects => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const isInMainWindow = useIsMainWindow();
  useRestartWhenIdle();

  useEffect(() => {
    if (isInMainWindow) {
      return;
    }
    const onFocus = () => {
      void hydrateOnboardingFromDb();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isInMainWindow]);

  return { anchorRef };
};
