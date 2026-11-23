import type { MountId, ProjectId, SessionId, SessionMountView } from '@goodboy/types';
import type {
  AttachMountInput,
  EnsureProjectMountedInput,
  EnsureProjectMountedResult,
} from '../../../../../store/slices/project-mounts/types';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly keptPath: string | null;
  readonly keptMountId: MountId | null;
  readonly ensureProjectMounted: (
    input: EnsureProjectMountedInput,
  ) => Promise<EnsureProjectMountedResult>;
  readonly attachMount: (input: AttachMountInput) => Promise<SessionMountView>;
};

const UNDO_REASON = 'mounted again by the user';

export const remountAfterUnmount = async ({
  sessionId,
  projectId,
  branch,
  keptPath,
  keptMountId,
  ensureProjectMounted,
  attachMount,
}: Params): Promise<boolean> => {
  if (keptMountId !== null) {
    await attachMount({ sessionId, mountId: keptMountId, canFetchRemote: true });
    return true;
  }
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
