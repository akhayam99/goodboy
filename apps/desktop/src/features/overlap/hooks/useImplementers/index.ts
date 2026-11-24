import type { Agent } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { implementerOf } from '../../implementerOf';
import type { MergeStep } from '../../overlapGroupOf';

type Params = {
  readonly steps: ReadonlyArray<MergeStep>;
};

const NO_AGENTS: ReadonlyArray<never> = [];

export const useImplementers = ({ steps }: Params): ReadonlyArray<Agent | null> =>
  useAppStore(
    useShallow((state) =>
      steps.map((step) =>
        implementerOf({
          agents: state.sessionPhaseRuns[step.mount.sessionId] ?? NO_AGENTS,
          mountId: step.mount.mountId,
        }),
      ),
    ),
  );
