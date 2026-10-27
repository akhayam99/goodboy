import type { MountId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { pushWithLease } from '../../../features/history/historyEngine';
import { ORIGIN_MOVED_MESSAGE } from '../../../features/history/originMovedMessage';
import { historyTargetOf } from '../history/historyTargetOf';
import type { BranchPushResult } from './branchPushResult';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly expectedRemoteSha: string | null;
  readonly sha?: string;
  readonly worktreePath?: string;
  readonly branch?: string;
};

export const pushExpectedLease = async ({
  get,
  sessionId,
  mountId,
  expectedRemoteSha,
  sha,
  worktreePath,
  branch,
}: Params): Promise<BranchPushResult> => {
  const target = historyTargetOf({ get, sessionId, mountId });
  const pushed = await pushWithLease({
    worktreePath: worktreePath ?? target.worktreePath,
    branch: branch ?? target.branch,
    expectedRemoteSha,
    ...(sha !== undefined && { sourceSha: sha }),
    workspaceId: target.workspaceId,
    projectId: target.projectId,
  }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
  if (pushed.kind === 'pushed') {
    get().recordLocalCheck({ mountId, answer: { error: null }, at: Date.now() });
    void get().refreshSessionPr(sessionId, { mountId, force: true, silent: true });
    return { ok: true };
  }
  if (pushed.kind === 'stale') {
    return { ok: false, reason: 'moved', error: ORIGIN_MOVED_MESSAGE };
  }
  get().recordLocalCheck({ mountId, answer: { error: pushed.message }, at: Date.now() });
  return { ok: false, reason: 'failed', error: pushed.message };
};
