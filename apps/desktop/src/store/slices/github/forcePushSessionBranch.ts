import type { MountId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { pushWithLease, readOriginAhead } from '../../../features/history/historyEngine';
import { ONLINE_COPY_CHANGED_MESSAGE } from '../../../features/history/onlineCopyChangedMessage';
import { ORIGIN_MOVED_MESSAGE } from '../../../features/history/originMovedMessage';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { sessionById } from '../sessions/sessionIndex';
import type { pushSessionBranch } from './pushSessionBranch';
import type { GetFn } from './types';

const NEVER_PUSHED_MESSAGE =
  'This branch has no online copy this machine knows of. Push it normally first.';

type PushResult = Awaited<ReturnType<typeof pushSessionBranch>>;

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
  readonly confirmedRemoteSha: string | null;
};

export const forcePushSessionBranch = async ({
  get,
  sessionId,
  mountId,
  confirmedOnlyOnline,
  confirmedRemoteSha,
}: Params): Promise<PushResult> => {
  const session = sessionById(get().sessions, sessionId);
  if (session === undefined) {
    return { ok: false, error: 'session not found' };
  }
  const repo = getSessionRepo({ get, sessionId, mountId });
  if (repo === null || repo === undefined || repo.branch.length === 0) {
    return { ok: false, error: 'no branch resolved for this mount to push from' };
  }
  const target = {
    worktreePath: repo.worktreePath,
    branch: repo.branch,
    workspaceId: session.workspaceId,
    projectId: repo.projectId,
  };
  const origin = await readOriginAhead({ ...target, since: null, isBringingIn: false }).catch(
    (error: unknown) => ({
      kind: 'failed' as const,
      message: formatError(error),
    }),
  );
  if ('kind' in origin) {
    return { ok: false, error: origin.message };
  }
  if (origin.knownRemoteSha === null) {
    return { ok: false, error: NEVER_PUSHED_MESSAGE };
  }
  if (origin.knownRemoteSha !== origin.remoteSha) {
    return { ok: false, error: ORIGIN_MOVED_MESSAGE };
  }
  const confirmed = new Set(confirmedOnlyOnline ?? []);
  const isRemoteMoved = confirmedRemoteSha !== null && origin.knownRemoteSha !== confirmedRemoteSha;
  if (isRemoteMoved || origin.onlyOnline.some((commit) => !confirmed.has(commit.sha))) {
    return { ok: false, error: ONLINE_COPY_CHANGED_MESSAGE };
  }
  const pushed = await pushWithLease({
    ...target,
    expectedRemoteSha: confirmedRemoteSha ?? origin.knownRemoteSha,
  }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
  if (pushed.kind === 'stale') {
    return { ok: false, error: ORIGIN_MOVED_MESSAGE };
  }
  if (pushed.kind === 'failed') {
    return { ok: false, error: pushed.message };
  }
  void get().refreshSessionPr(sessionId, { mountId, force: true, silent: true });
  return { ok: true };
};
