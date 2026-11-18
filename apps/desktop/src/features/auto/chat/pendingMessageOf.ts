import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { noteWordOf } from '../tree/noteWordOf';

export type PendingMessageAction = 'sendNow' | 'raiseLimit' | 'retry';

export type PendingMessageLine = Readonly<{
  tone: 'waits' | 'notDelivered';
  text: string;
  reason: string | null;
  action: PendingMessageAction | null;
}>;

type Params = {
  readonly view: AutoTreeView;
};

const STOPPED_REASON = 'The Lead was stopped.';

const NOT_DELIVERED = 'Not delivered';

export const pendingMessageLineOf = ({ view }: Params): PendingMessageLine => {
  const { phase, blockedReason } = view.tree;
  if (phase === 'stopping' || phase === 'stopped') {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason: STOPPED_REASON, action: null };
  }
  if (phase !== 'blocked') {
    return { tone: 'waits', text: noteWordOf({ turn: null }), reason: null, action: null };
  }
  const reason =
    blockedReason === null || blockedReason === '' ? "The Lead couldn't reply." : blockedReason;
  if (blockedReason === AUTO_BLOCK_TEXT.budget) {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: 'raiseLimit' };
  }
  if (blockedReason === AUTO_BLOCK_TEXT.limit_wall_clock) {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: null };
  }
  return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: 'retry' };
};
