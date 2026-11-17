import type { ResolveThread } from '@goodboy/types';
import { commentScopeOf } from './commentScopeOf';
import { isFixableThread } from './fixableComments';

export type CommentLane = 'fix' | 'run' | 'in_run';

type LaneNote = {
  readonly body: string;
  readonly path: string | null;
};

type LaneRow = {
  readonly thread: Pick<ResolveThread, 'threadId' | 'stage' | 'state' | 'stateReason'>;
  readonly reviewerNote: LaneNote | null;
};

type Params = {
  readonly row: LaneRow;
  readonly inRunThreadIds: ReadonlySet<string>;
};

export const commentLaneOf = ({ row, inRunThreadIds }: Params): CommentLane | null => {
  if (inRunThreadIds.has(row.thread.threadId)) {
    return 'in_run';
  }
  if (!isFixableThread({ thread: row.thread })) {
    return null;
  }
  const note = row.reviewerNote;
  return note !== null && commentScopeOf({ body: note.body, path: note.path }).isBroad
    ? 'run'
    : 'fix';
};
