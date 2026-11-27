import type { ChatId } from '@goodboy/types';
import type { ChatQueueState } from './state';
import type { QueuedChatTurn } from './types';

type StateParams = {
  readonly state: ChatQueueState;
  readonly chatId: ChatId;
};

type PatchParams = StateParams & {
  readonly itemId: string;
  readonly patch: Partial<QueuedChatTurn>;
};

type RemoveParams = StateParams & {
  readonly itemId: string;
};

type WithQueueParams = StateParams & {
  readonly queue: ReadonlyArray<QueuedChatTurn>;
};

const withQueue = ({
  state,
  chatId,
  queue,
}: WithQueueParams): Pick<ChatQueueState, 'chatQueues'> => {
  const { [chatId]: _previous, ...others } = state.chatQueues;
  return { chatQueues: queue.length === 0 ? others : { ...others, [chatId]: queue } };
};

export const queueOf = ({ state, chatId }: StateParams): ReadonlyArray<QueuedChatTurn> =>
  state.chatQueues[chatId] ?? [];

export const patchQueuedTurn = ({ state, chatId, itemId, patch }: PatchParams) =>
  withQueue({
    state,
    chatId,
    queue: queueOf({ state, chatId }).map((turn) =>
      turn.id === itemId ? { ...turn, ...patch } : turn,
    ),
  });

export const withoutQueuedTurn = ({ state, chatId, itemId }: RemoveParams) =>
  withQueue({
    state,
    chatId,
    queue: queueOf({ state, chatId }).filter((turn) => turn.id !== itemId),
  });

type AppendParams = StateParams & {
  readonly turn: QueuedChatTurn;
};

export const appendQueuedTurn = ({ state, chatId, turn }: AppendParams) =>
  withQueue({ state, chatId, queue: [...queueOf({ state, chatId }), turn] });

type FailParams = RemoveParams & {
  readonly failure: string;
};

export const failQueuedTurn = ({ state, chatId, itemId, failure }: FailParams) =>
  patchQueuedTurn({
    state,
    chatId,
    itemId,
    patch: { status: 'failed', failure },
  });

export const isQueued = ({ state, chatId, itemId }: RemoveParams): boolean =>
  queueOf({ state, chatId }).some((turn) => turn.id === itemId);
