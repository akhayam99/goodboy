import { extractAllCommentResolved } from '@goodboy/core';
import type { BranchCommit, ProviderRunId, TurnEvent } from '@goodboy/types';
import { branchShaMatches } from './branchShaMatches';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly shaByThreadId: Readonly<Record<string, string>>;
};

type Report = {
  readonly at: number;
  readonly sha: string;
};

const MARKER_CLOSE = '>>';

const epochOf = ({ iso }: { readonly iso: string }): number => {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const onBranch = ({
  sha,
  commits,
}: {
  readonly sha: string;
  readonly commits: ReadonlyArray<BranchCommit>;
}): string => {
  const found = commits.find((commit) => branchShaMatches({ sha: commit.sha, candidate: sha }));
  return found?.sha ?? sha;
};

export const resolverFileCommits = ({
  events,
  commits,
  shaByThreadId,
}: Params): Readonly<Record<string, string>> => {
  const textByRun = new Map<ProviderRunId, string>();
  const seen = new Set<string>();
  const reports: Report[] = [];
  const lastEditAt = new Map<string, number>();

  for (const event of events) {
    if (event.kind === 'file_edit') {
      lastEditAt.set(event.path, epochOf({ iso: event.at }));
      continue;
    }
    if (event.kind !== 'assistant_text') {
      continue;
    }
    const text = `${textByRun.get(event.runId) ?? ''}${event.delta}`;
    textByRun.set(event.runId, text);
    if (!event.delta.includes(MARKER_CLOSE)) {
      continue;
    }
    for (const marker of extractAllCommentResolved(text)) {
      const key = `${marker.threadId} ${marker.commitSha}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      reports.push({
        at: epochOf({ iso: event.at }),
        sha: onBranch({ sha: shaByThreadId[marker.threadId] ?? marker.commitSha, commits }),
      });
    }
  }

  const newest = reports[reports.length - 1];
  if (newest === undefined) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [path, editedAt] of lastEditAt) {
    out[path] = (reports.find((report) => report.at >= editedAt) ?? newest).sha;
  }
  return out;
};
