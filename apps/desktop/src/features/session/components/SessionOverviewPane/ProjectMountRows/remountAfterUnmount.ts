import type { ProjectId, SessionId } from '@goodboy/types';
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
  await ensureProjectMounted({
    sessionId,
    projectId,
    reason: UNDO_REASON,
    ...(branch === ''
      ? {}
      : { restore: { branch, worktreePath: keptPath === '' ? null : keptPath } }),
  });
  return true;
};
