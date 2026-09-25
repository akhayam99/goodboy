import { setResolveThreadCommitShas } from '@goodboy/db';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { remapCommitShas } from '../../../features/resolve/commitMapping';
import { worktreeCommitRange } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly baseSha: string;
  readonly candidateSha: string;
  readonly integratedSha: string;
  readonly threads: ReadonlyArray<ResolveThread>;
};

export const remapIntegratedCommits = async ({
  sessionId,
  worktreePath,
  baseSha,
  candidateSha,
  integratedSha,
  threads,
}: Params): Promise<void> => {
  if (integratedSha === candidateSha) {
    return;
  }
  const before = await worktreeCommitRange({ worktreePath, base: baseSha, head: candidateSha });
  if (before.length === 0) {
    return;
  }
  const after = await worktreeCommitRange({
    worktreePath,
    base: `${integratedSha}~${before.length}`,
    head: integratedSha,
  });
  for (const thread of threads) {
    const shas = thread.commitShas ?? [];
    const next = remapCommitShas({ shas, before, after });
    if (next.every((sha, index) => sha === shas[index])) {
      continue;
    }
    await setResolveThreadCommitShas({
      db: tauriDatabase,
      sessionId,
      threadId: thread.threadId,
      commitShas: next,
    });
  }
};
