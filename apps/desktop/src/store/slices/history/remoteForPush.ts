import { formatError } from '@goodboy/ui';
import type { HistoryRemoteLease } from '@goodboy/types';
import { readRemoteLease } from '../../../features/history/historyEngine';
import { worktreeStatus } from '../../../features/worktree/worktree';
import type { HistoryStop, HistoryTarget } from './types';

export type RemoteForPush = {
  readonly hasUpstream: boolean;
  readonly sha: string | null;
  readonly stop: HistoryStop | null;
};

type Params = {
  readonly target: HistoryTarget;
  readonly expectedHead: string;
  readonly incorporated: string | null;
  readonly incorporatedSince: string | null;
  readonly shouldPush: boolean;
};

export const remoteForPush = async ({
  target,
  expectedHead,
  incorporated,
  incorporatedSince,
  shouldPush,
}: Params): Promise<RemoteForPush> => {
  const status = await worktreeStatus({
    worktreePath: target.worktreePath,
    baseBranch: target.baseBranch,
  }).catch(() => null);
  const lease = await readRemoteLease({
    worktreePath: target.worktreePath,
    branch: target.branch,
    expectedHead,
    incorporated,
    incorporatedSince,
    workspaceId: target.workspaceId,
    projectId: target.projectId,
  }).catch((error: unknown): HistoryRemoteLease => ({
    kind: 'unknown',
    reason: formatError(error),
  }));
  const hasUpstream =
    lease.kind === 'included' ||
    lease.kind === 'not-included' ||
    (status?.upstream ?? null) !== null;
  if (shouldPush && lease.kind === 'not-included') {
    return {
      hasUpstream,
      sha: null,
      stop: {
        reason: 'origin-moved',
        message:
          'The online copy has commits this rewrite does not include. Nothing was changed. Bring them into the plan first.',
        files: [],
        sha: lease.sha,
      },
    };
  }
  if (shouldPush && lease.kind === 'unknown' && hasUpstream) {
    return {
      hasUpstream,
      sha: null,
      stop: {
        reason: 'failed',
        message: `Couldn't read the online copy, so nothing was changed. ${lease.reason}`.trim(),
        files: [],
        sha: null,
      },
    };
  }
  return { hasUpstream, sha: lease.kind === 'included' ? lease.sha : null, stop: null };
};
