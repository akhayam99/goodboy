import type { Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { pageLensOf } from '../../pageLensOf';

type Params = {
  readonly session: Session;
};

export const useSessionPageLens = ({ session }: Params): LensKind | null => {
  const sessionId = session.id;
  const lens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const focusedRunId = useAppStore((state) => state.focusedWorkflowRunId[sessionId] ?? null);
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  return pageLensOf({ lens, isBranchless, focusedRunId, runs: session.workflowRuns });
};
