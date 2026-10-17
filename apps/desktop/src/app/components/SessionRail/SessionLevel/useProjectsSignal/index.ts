import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { entryAriaLabel } from '../../../../../features/branch/entryAriaLabel';
import { mountReviewGithub } from '../../../../../features/review/mountReviewGithub';
import { commentsWaitingOf } from '../commentsWaitingOf';
import { worktreeCardEntriesOf } from '../worktreeCardEntriesOf';
import { worktreeRowStateFor } from '../worktreeRowStateFor';
import type { WorktreeRowState } from '../worktreeRowStateOf';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
};

const QUIET: WorktreeRowState = { tone: null, reason: null };

export const useProjectsSignal = ({ sessionId, rows, statuses }: Params): WorktreeRowState => {
  const waiting = useAppStore(
    useShallow((state) => rows.map((row) => commentsWaitingOf({ state, sessionId, row }))),
  );
  const githubs = useAppStore(
    useShallow((state) =>
      rows.map((row) => mountReviewGithub({ state, sessionId, mountId: row.mountId })),
    ),
  );
  const items = useAppStore((state) => state.sessionResolveQueueItems[sessionId] ?? EMPTY_ARRAY);
  return useMemo(() => {
    const threads = items.map((entry) => entry.thread);
    const states = rows.flatMap((row, index): ReadonlyArray<WorktreeRowState> => {
      const entries = worktreeCardEntriesOf({
        row,
        github: githubs[index] ?? null,
        threads,
        diff: null,
      });
      return [
        worktreeRowStateFor({
          row,
          status: row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null),
          commentsWaiting: waiting[index] ?? 0,
        }),
        ...entries.flatMap((entry) =>
          entry.fact.tone === 'danger' || entry.fact.tone === 'warning'
            ? [
                {
                  tone: entry.fact.tone,
                  reason: `${row.projectName}, ${entryAriaLabel({ label: entry.label, fact: entry.fact })}`,
                },
              ]
            : [],
        ),
      ];
    });
    return (
      states.find((state) => state.tone === 'danger') ??
      states.find((state) => state.tone === 'warning') ??
      QUIET
    );
  }, [githubs, items, rows, statuses, waiting]);
};
