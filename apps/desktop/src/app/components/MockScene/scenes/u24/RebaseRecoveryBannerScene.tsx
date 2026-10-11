import { useEffect, useState } from 'react';
import { RebaseJobBranchScene } from './RebaseJobBranchScene';
import type { RebaseJobSceneState } from './rebaseJobSeed';

type Props = {
  readonly state: RebaseJobSceneState;
  readonly isNoteOpen?: boolean;
};

const OPEN_DELAY_MS = 500;

export const RebaseRecoveryBannerScene = ({ state, isNoteOpen = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, '', `/?state=${state}`);
    setIsReady(true);
  }, [state]);

  useEffect(() => {
    if (!isReady || !isNoteOpen) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Retry with a note',
      );
      button?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, isNoteOpen]);

  return isReady ? <RebaseJobBranchScene /> : null;
};
