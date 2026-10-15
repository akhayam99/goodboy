import type { BranchCommit } from '@goodboy/types';
import type { CheckFixCommit } from './types';

type Params = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly startedAt: string;
};

const MS_PER_SECOND = 1_000;

export const fixCommitOf = ({ commits, startedAt }: Params): CheckFixCommit => {
  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return { kind: 'unreadable' };
  }
  const since = Math.floor(startedAtMs / MS_PER_SECOND);
  const made = commits.filter((commit) => commit.timestamp >= since);
  const newest = made.reduce<BranchCommit | null>(
    (latest, commit) => (latest === null || commit.timestamp > latest.timestamp ? commit : latest),
    null,
  );
  if (newest === null) {
    return { kind: 'none' };
  }
  return {
    kind: 'found',
    sha: newest.shortSha,
    subject: newest.subject,
    count: made.length,
    unpushed: made.filter((commit) => !commit.pushed).length,
  };
};
