import type { BranchCommit } from '@goodboy/types';
import { branchShaMatches } from './branchShaMatches';

export type AttributedCommits = {
  readonly reported: ReadonlyArray<BranchCommit>;
  readonly reportedMissingShas: ReadonlyArray<string>;
  readonly withinRunWindow: ReadonlyArray<BranchCommit>;
};

const toEpoch = ({ iso }: { readonly iso: string | undefined }): number | null => {
  if (iso === undefined) {
    return null;
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};

type Params = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly reportedShas: ReadonlyArray<string>;
  readonly startedAt: string | undefined;
  readonly completedAt: string | undefined;
  readonly now: number;
};

export const attributeResolverCommits = ({
  commits,
  reportedShas,
  startedAt,
  completedAt,
  now,
}: Params): AttributedCommits => {
  const reported: BranchCommit[] = [];
  const reportedMissingShas: string[] = [];
  const matchedShas = new Set<string>();
  for (const sha of reportedShas) {
    const found = commits.find((commit) => branchShaMatches({ sha: commit.sha, candidate: sha }));
    if (found === undefined) {
      reportedMissingShas.push(sha);
      continue;
    }
    matchedShas.add(found.sha);
    reported.push(found);
  }
  const from = toEpoch({ iso: startedAt });
  if (from === null) {
    return { reported, reportedMissingShas, withinRunWindow: [] };
  }
  const until = toEpoch({ iso: completedAt }) ?? Math.floor(now / 1000);
  const withinRunWindow = commits.filter(
    (commit) =>
      !matchedShas.has(commit.sha) && commit.timestamp >= from && commit.timestamp <= until,
  );
  return { reported, reportedMissingShas, withinRunWindow };
};
