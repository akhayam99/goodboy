import type { ProjectId, SessionId } from '@goodboy/types';
import {
  rememberExistingWorktree,
  rememberPickedBranch,
} from '../../../../../store/slices/sessions/branchChoiceSeeds';
import type {
  EnsureProjectMountedInput,
  EnsureProjectMountedResult,
} from '../../../../../store/slices/project-mounts/types';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly keptPath: string | null;
  readonly ensureProjectMounted: (
    input: EnsureProjectMountedInput,
  ) => Promise<EnsureProjectMountedResult>;
};

const UNDO_REASON = 'mounted again by the user';

export const remountAfterUnmount = async ({
  sessionId,
  projectId,
  branch,
  keptPath,
  ensureProjectMounted,
}: Params): Promise<boolean> => {
  if (branch !== '' && keptPath !== null && keptPath !== '') {
    rememberExistingWorktree({ sessionId, branch, worktreePath: keptPath });
  }
  if (branch !== '' && (keptPath === null || keptPath === '')) {
    rememberPickedBranch({ sessionId, branch });
  }
  await ensureProjectMounted({ sessionId, projectId, reason: UNDO_REASON });
  return true;
};
