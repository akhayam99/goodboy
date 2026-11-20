import type { StarredIssue, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issues: ReadonlyArray<StarredIssue>;
};

export const restoreUnstarredClosed = async ({ workspaceId, issues }: Params): Promise<boolean> => {
  const state = useAppStore.getState();
  try {
    await state.restoreStarredIssues({ workspaceId, issues });
    return true;
  } catch (error) {
    void state.reportError({
      recovery: CHECK_STATE,
      title: "Couldn't restore the stars",
      error,
      workspaceId,
    });
    return false;
  }
};
