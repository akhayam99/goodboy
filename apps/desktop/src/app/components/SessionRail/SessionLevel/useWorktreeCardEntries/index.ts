import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import type { EntryDiffStat } from '../../../../../features/branch/worktreeEntryFacts';
import { mountReviewGithub } from '../../../../../features/review/mountReviewGithub';
import { worktreeCardEntriesOf, type WorktreeCardEntry } from '../worktreeCardEntriesOf';

type Params = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly diff: EntryDiffStat | null;
};

export const useWorktreeCardEntries = ({
  sessionId,
  row,
  diff,
}: Params): ReadonlyArray<WorktreeCardEntry> => {
  const github = useAppStore((state) =>
    mountReviewGithub({ state, sessionId, mountId: row.mountId }),
  );
  const items = useAppStore((state) => state.sessionResolveQueueItems[sessionId] ?? EMPTY_ARRAY);
  return useMemo(
    () =>
      worktreeCardEntriesOf({
        row,
        github,
        threads: items.map((entry) => entry.thread),
        diff,
      }),
    [row, github, items, diff],
  );
};
