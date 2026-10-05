import type { Tone } from '@goodboy/ui';
import type {
  DiffComment,
  EffortLevel,
  ResolveAttempt,
  ResolveQueueItemWithThread,
} from '@goodboy/types';
import { EFFORT_LABEL, modelLabel } from '../../chat/utils/chat-constants';
import { buildResolveQueueRows, type ResolveQueueRow } from '../../resolve/buildResolveQueueRows';
import { noteIdOfThread, noteThreadId } from '../../resolve/notes/noteThread';
import {
  REVIEW_COMMENT_TONE,
  reviewCommentStateOf,
  reviewCommentWord,
  type ReviewCommentState,
} from '../../resolve/reviewCommentState';
import { REVIEW_LAUNCH_LABEL } from '../../resolve/reviewLaunchCopy';

export type NoteFixGroup = 'open' | 'working' | 'needs' | 'ready' | 'failed' | 'done';

export const NOTE_LOCK_REASON = 'A fixer is working on this note';

const OPEN_NOTE_WORD = 'Open note';
const CLOSED_NOTE_WORD = 'Closed';

export type NoteFix = {
  readonly note: DiffComment;
  readonly threadId: string;
  readonly state: ReviewCommentState | null;
  readonly group: NoteFixGroup;
  readonly word: string;
  readonly tone: Tone;
  readonly run: string | null;
  readonly isClosed: boolean;
  readonly canReopen: boolean;
  readonly isLocked: boolean;
};

type Params = {
  readonly notes: ReadonlyArray<DiffComment>;
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
};

const GROUP_OF_STATE: Record<ReviewCommentState, NoteFixGroup> = {
  new: 'open',
  drafting: 'working',
  needs: 'needs',
  ready: 'ready',
  edited: 'ready',
  outdated: 'ready',
  failed: 'failed',
  accepted: 'done',
  replied: 'done',
  skipped: 'done',
  pushed: 'done',
  resolved: 'done',
};

const isEffortLevel = (value: string): value is EffortLevel => value in EFFORT_LABEL;

const runLineOf = ({ attempt }: { readonly attempt: ResolveAttempt | null }): string | null => {
  if (attempt === null) {
    return null;
  }
  const style = attempt.launchChoice?.commitStyle ?? null;
  return [
    modelLabel(attempt.model),
    attempt.effort !== null && isEffortLevel(attempt.effort) ? EFFORT_LABEL[attempt.effort] : null,
    style === null
      ? null
      : style === 'fixup'
        ? REVIEW_LAUNCH_LABEL.fixup
        : REVIEW_LAUNCH_LABEL.newCommit,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

const noteIdOfRow = ({ row }: { readonly row: ResolveQueueRow }): string | null =>
  row.thread.diffCommentId ?? noteIdOfThread({ threadId: row.thread.threadId });

const wordOf = ({
  state,
  row,
  isClosed,
}: {
  readonly state: ReviewCommentState | null;
  readonly row: ResolveQueueRow | undefined;
  readonly isClosed: boolean;
}): string => {
  if (row === undefined || state === null || state === 'new' || state === 'resolved') {
    return isClosed ? CLOSED_NOTE_WORD : OPEN_NOTE_WORD;
  }
  return reviewCommentWord({ state, row });
};

export const noteFixesOf = ({ notes, entries, attempts }: Params): ReadonlyArray<NoteFix> => {
  const rows = buildResolveQueueRows({
    entries: entries.filter((entry) => entry.thread.originKind === 'diff_comment'),
    attempts,
    deliveryReceipts: [],
    comments: [],
    notes,
  });
  const latest = new Map<string, ResolveQueueRow>();
  for (const row of rows) {
    const noteId = noteIdOfRow({ row });
    if (noteId === null) {
      continue;
    }
    const current = latest.get(noteId);
    if (current === undefined || row.thread.generation > current.thread.generation) {
      latest.set(noteId, row);
    }
  }
  return notes.map((note): NoteFix => {
    const row = latest.get(note.id);
    const isClosed = note.status === 'resolved';
    const state = row === undefined ? null : reviewCommentStateOf({ row });
    const group = isClosed ? 'done' : state === null ? 'open' : GROUP_OF_STATE[state];
    return {
      note,
      threadId: row?.thread.threadId ?? noteThreadId({ noteId: note.id }),
      state,
      group,
      word: wordOf({ state, row, isClosed }),
      tone: state === null || state === 'new' ? 'primary' : REVIEW_COMMENT_TONE[state],
      run: runLineOf({ attempt: row?.attempt ?? null }),
      isClosed,
      canReopen: isClosed && (state === null || state === 'new' || state === 'resolved'),
      isLocked: !isClosed && state === 'drafting',
    };
  });
};
