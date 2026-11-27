import type { QueuedRow } from '../chat/queuedMessages/queuedRow';
import { NAMES } from '../../shared/utils/names';
import type { QueuedChatTurn } from '../../store/slices/chatQueue/types';

const NOT_DELIVERED_TEXT = 'Not delivered';
const PAUSED_TEXT = 'Sends after your next reply';

type Params = {
  readonly queue: ReadonlyArray<QueuedChatTurn>;
  readonly isStreaming: boolean;
};

type RowParams = {
  readonly turn: QueuedChatTurn;
  readonly isHead: boolean;
  readonly isStreaming: boolean;
};

type Line = Pick<QueuedRow, 'status' | 'statusText' | 'reason' | 'action'>;

const chatRowLineOf = ({ turn, isHead, isStreaming }: RowParams): Line => {
  if (turn.status === 'failed') {
    return {
      status: 'notDelivered',
      statusText: NOT_DELIVERED_TEXT,
      reason: turn.failure,
      action: 'retry',
    };
  }
  if (isStreaming) {
    return { status: 'queued', statusText: NAMES.waitsForThisReply, reason: null, action: null };
  }
  return {
    status: 'queued',
    statusText: PAUSED_TEXT,
    reason: null,
    action: isHead ? 'sendNow' : null,
  };
};

export const queuedChatRowsOf = ({ queue, isStreaming }: Params): ReadonlyArray<QueuedRow> =>
  queue.map((turn, index): QueuedRow => ({
    id: turn.id,
    source: 'agent',
    content: turn.content,
    images: [],
    imageCount: turn.attachments.length,
    override: undefined,
    ...chatRowLineOf({ turn, isHead: index === 0, isStreaming }),
  }));
