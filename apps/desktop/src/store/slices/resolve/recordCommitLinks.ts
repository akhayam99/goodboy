import { setResolveThreadCommitLinks } from '@goodboy/db';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { fixupTargetOf } from '../../../features/resolve/fixupTargetOf';
import {
  listBranchCommits,
  worktreeCommitRange,
  worktreeIsAncestor,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly baseSha: string;
  readonly candidateSha: string;
  readonly threads: ReadonlyArray<ResolveThread>;
};

export const recordCommitLinks = async ({
  sessionId,
  worktreePath,
  baseSha,
  candidateSha,
  threads,
}: Params): Promise<void> => {
  const range = await worktreeCommitRange({
    worktreePath,
    base: baseSha,
    head: candidateSha,
  }).catch(() => []);
  const branch = await listBranchCommits(worktreePath).catch(() => []);
  for (const thread of threads) {
    const sha = thread.commitShas?.at(-1);
    if (sha === undefined) {
      continue;
    }
    const fixupOfSha = fixupTargetOf({ sha, range, branch });
    const isStacked =
      thread.replacesSha !== null &&
      (await worktreeIsAncestor({
        worktreePath,
        sha: thread.replacesSha,
        head: candidateSha,
      }).catch(() => false));
    const replacesSha = isStacked ? null : thread.replacesSha;
    if (fixupOfSha === thread.fixupOfSha && replacesSha === thread.replacesSha) {
      continue;
    }
    await setResolveThreadCommitLinks({
      db: tauriDatabase,
      sessionId,
      threadId: thread.threadId,
      fixupOfSha,
      replacesSha,
    });
  }
};
