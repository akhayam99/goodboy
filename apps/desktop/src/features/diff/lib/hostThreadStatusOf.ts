import type { Tone } from '@goodboy/ui';
import type { ResolveQueueRow } from '../../resolve/buildResolveQueueRows';
import {
  REVIEW_COMMENT_TONE,
  reviewCommentStateOf,
  reviewCommentToneKeyOf,
  reviewCommentWord,
} from '../../resolve/reviewCommentState';
import { FIX_GROUP_OF_STATE } from './noteFixes';

export type HostThreadStatus = {
  readonly label: string;
  readonly tone: Tone;
  readonly isDone: boolean;
};

type Params = {
  readonly row: ResolveQueueRow | null;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
};

const RESOLVED: HostThreadStatus = { label: 'Resolved', tone: 'neutral', isDone: true };

const OUTDATED: HostThreadStatus = { label: 'Outdated', tone: 'neutral', isDone: false };

const OPEN: HostThreadStatus = { label: 'Open', tone: 'neutral', isDone: false };

export const hostThreadStatusOf = ({ row, isResolved, isOutdated }: Params): HostThreadStatus => {
  if (isResolved) {
    return RESOLVED;
  }
  const state = row === null ? null : reviewCommentStateOf({ row });
  if (row !== null && state !== null && state !== 'new' && state !== 'resolved') {
    return {
      label: reviewCommentWord({ state, row }),
      tone: REVIEW_COMMENT_TONE[reviewCommentToneKeyOf({ state, row })],
      isDone: FIX_GROUP_OF_STATE[state] === 'done',
    };
  }
  return isOutdated ? OUTDATED : OPEN;
};
