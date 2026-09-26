import type { FixupTarget } from '../chat/spawn-from-comment';
import type { CommentThread } from '../github/comment-threads';
import { listBranchCommits, worktreeBlameLine } from '../worktree/worktree';

type Params = {
  readonly worktreePath: string;
  readonly threads: ReadonlyArray<CommentThread>;
};

export const resolveFixupTargets = async ({
  worktreePath,
  threads,
}: Params): Promise<ReadonlyArray<FixupTarget>> => {
  const branch = await listBranchCommits(worktreePath).catch(() => []);
  const subjects = new Map(branch.map((commit) => [commit.sha, commit.subject]));
  const targets: Array<FixupTarget> = [];
  for (const { head } of threads) {
    const threadId = head.threadId?.trim() ?? '';
    if (threadId === '' || !head.path || !head.line) {
      continue;
    }
    const sha = await worktreeBlameLine({ worktreePath, path: head.path, line: head.line }).catch(
      () => null,
    );
    const subject = sha === null ? undefined : subjects.get(sha);
    if (sha === null || subject === undefined) {
      continue;
    }
    targets.push({ threadId, sha, subject });
  }
  return targets;
};
