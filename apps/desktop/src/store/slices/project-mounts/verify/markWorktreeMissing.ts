import { getSessionMount, updateSessionMountLifecycle } from '@goodboy/db';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { tauriDatabase } from '../../../../shared/lib/db';

export type WorktreeCandidate = {
  readonly id: string;
  readonly projectId?: ProjectId;
  readonly worktreePath: string | null;
  readonly revision?: number;
};

type Params = {
  readonly sessionId: SessionId;
  readonly candidate: WorktreeCandidate;
};

export const markWorktreeMissing = async ({ sessionId, candidate }: Params): Promise<void> => {
  const mountId = brandId<MountId>({ value: candidate.id });
  const storedRevision =
    candidate.revision ??
    (
      await getSessionMount({ db: tauriDatabase, sessionId, mountId }).catch((error) => {
        console.error('read session mount failed', error);
        return null;
      })
    )?.revision ??
    0;
  await updateSessionMountLifecycle({
    db: tauriDatabase,
    sessionId,
    mountId,
    worktreePath: null,
    isAttached: false,
    diskState: 'missing',
    expectedRevision: storedRevision,
    updatedAt: isoNow(),
  }).catch((error) => console.error('mark worktree missing failed', error));
};
