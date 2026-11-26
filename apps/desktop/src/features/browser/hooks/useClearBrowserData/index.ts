import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { browserFailureText } from '../../browserFailureText';
import { browserHost } from '../../browserHost';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type Phase = 'idle' | 'confirm' | 'clearing' | 'done' | 'failed';

type Outcome = {
  readonly workspaceId: WorkspaceId;
  readonly phase: Phase;
  readonly text: string | null;
};

type ClearBrowserData = {
  readonly phase: Phase;
  readonly text: string | null;
  readonly ask: () => void;
  readonly cancel: () => void;
  readonly clear: () => Promise<void>;
};

const CLEARED = 'Cleared. Open tabs reloaded.';
const CLEARED_RESTART = 'Cleared. Restart Goodboy to finish.';

export const useClearBrowserData = ({ workspaceId }: Params): ClearBrowserData => {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const isOwn = outcome !== null && outcome.workspaceId === workspaceId;
  const settle = ({ workspaceId: target, phase, text }: Outcome): void => {
    setOutcome((current) =>
      current !== null && current.workspaceId !== target
        ? current
        : { workspaceId: target, phase, text },
    );
  };
  return {
    phase: isOwn ? outcome.phase : 'idle',
    text: isOwn ? outcome.text : null,
    ask: () => setOutcome({ workspaceId, phase: 'confirm', text: null }),
    cancel: () => setOutcome(null),
    clear: async () => {
      const target = workspaceId;
      setOutcome({ workspaceId: target, phase: 'clearing', text: null });
      try {
        const cleared = await browserHost.clearProfile({ workspaceId: target });
        settle({
          workspaceId: target,
          phase: 'done',
          text: cleared.shouldRestart ? CLEARED_RESTART : CLEARED,
        });
      } catch (failure) {
        settle({
          workspaceId: target,
          phase: 'failed',
          text: browserFailureText({ error: failure }),
        });
      }
    },
  };
};
