import { useMemo } from 'react';
import type { DiffComment, SessionId } from '@goodboy/types';
import { useReviewEntries, type ReviewEntry } from '../../components/ReviewFlow/useReviewEntries';
import { fixRunOf, type FixRun } from '../../fixRun';
import { groupConversationsByFile } from '../../groupConversationsByFile';
import { useLaneStatus } from '../../hooks/useLaneStatus';
import type { LaneStatus } from '../../laneStatus';
import { fixableNoteIdsOf, isNoteEntry, isOpenNoteEntry } from '../noteEntries';
import { isOpenNote } from '../noteThread';
import { useBranchNotes } from '../useBranchNotes';

type NoteFileGroup = {
  readonly key: string;
  readonly path: string | null;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

export type ReviewNotes = {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly open: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<NoteFileGroup>;
  readonly closed: ReadonlyArray<DiffComment>;
  readonly fixableIds: ReadonlyArray<string>;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
};

export const useReviewNotes = ({ sessionId }: { readonly sessionId: SessionId }): ReviewNotes => {
  const { entries } = useReviewEntries({ sessionId, scope: 'all' });
  const { onBranch } = useBranchNotes({ sessionId, scope: 'displayed' });
  const lane = useLaneStatus({ sessionId, entries });
  return useMemo(() => {
    const notes = entries.filter((entry) => isNoteEntry({ entry }));
    const open = notes.filter((entry) => isOpenNoteEntry({ entry }));
    const byThread = new Map(open.map((entry) => [entry.threadId, entry] as const));
    const groups = groupConversationsByFile({ rows: open.map((entry) => entry.row) }).map(
      (group) => ({
        key: group.key,
        path: group.path,
        entries: group.rows.flatMap((row) => {
          const entry = byThread.get(row.thread.threadId);
          return entry === undefined ? [] : [entry];
        }),
      }),
    );
    return {
      entries,
      open,
      groups,
      closed: onBranch.filter((note) => !isOpenNote({ note })),
      fixableIds: fixableNoteIdsOf({ entries: open }),
      run: fixRunOf({
        sources: notes.map((entry) => ({
          threadId: entry.threadId,
          state: entry.state,
          attempt: entry.row.attempt,
        })),
      }),
      lane,
    };
  }, [entries, lane, onBranch]);
};
