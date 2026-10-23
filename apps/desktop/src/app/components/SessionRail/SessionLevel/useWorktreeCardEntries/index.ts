import { useMemo } from 'react';
import type { PrCheckRun, SessionId, WorktreeStatus } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import type { BranchScope } from '../../../../../features/branch/branchTabs';
import type { EntryDiffStat } from '../../../../../features/branch/worktreeEntryFacts';
import { mountPullRequestView } from '../../../../../features/review/mountPullRequestView';
import { mountReviewGithub } from '../../../../../features/review/mountReviewGithub';
import {
  checkRunsOf,
  worktreeCardEntriesOf,
  type WorktreeCardEntry,
} from '../worktreeCardEntriesOf';

type Params = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly diff: EntryDiffStat | null;
  readonly scope: BranchScope | null;
  readonly status: WorktreeStatus | null;
};

type WorktreeCardFacts = {
  readonly entries: ReadonlyArray<WorktreeCardEntry>;
  readonly runs: ReadonlyArray<PrCheckRun> | null;
};

export const useWorktreeCardEntries = ({
  sessionId,
  row,
  diff,
  scope,
  status,
}: Params): WorktreeCardFacts => {
  const github = useAppStore((state) =>
    mountReviewGithub({ state, sessionId, mountId: row.mountId }),
  );
  const commits = useAppStore((state) => state.historyDrafts[row.mountId]?.commits ?? null);
  const hasRemoteHead = useAppStore(
    (state) => state.historyDrafts[row.mountId]?.graph?.remoteSha != null,
  );
  const items = useAppStore((state) => state.sessionResolveQueueItems[sessionId] ?? EMPTY_ARRAY);
  const view = useAppStore((state) =>
    mountPullRequestView({
      state,
      sessionId,
      mountId: row.mountId,
      prNumber: row.request?.number ?? null,
    }),
  );
  return useMemo(
    () => ({
      entries: worktreeCardEntriesOf({
        row,
        github,
        threads: items.map((entry) => entry.thread),
        diff,
        view,
        scope,
        status,
        commits,
        hasRemoteHead,
      }),
      runs: checkRunsOf({ row, github, view }),
    }),
    [row, github, items, diff, view, scope, status, commits, hasRemoteHead],
  );
};
