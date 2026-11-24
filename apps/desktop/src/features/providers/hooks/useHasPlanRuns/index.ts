import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useHasPlanRuns = ({ workspaceId }: Params): boolean =>
  useAppStore((state) =>
    state.sessions.some(
      (session) =>
        session.workspaceId === workspaceId &&
        session.workflowRuns.some(
          (run) => run.executionMode === 'dynamic' && run.discardedAt == null,
        ),
    ),
  );
