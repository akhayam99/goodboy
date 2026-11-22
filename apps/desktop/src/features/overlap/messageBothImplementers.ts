import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

export const SEND_AFTER_MS = 10_000;
export const NOT_SAVED = "The message couldn't be saved, so it was not sent.";

export type ImplementerNote = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  content: string;
}>;

type Params = {
  readonly notes: ReadonlyArray<ImplementerNote>;
};

export type MessageOutcome = Readonly<{ isSent: true } | { isSent: false; failure: string }>;

type Queued = ImplementerNote & Readonly<{ itemId: string }>;

type QueuedParams = {
  readonly item: Queued;
};

const isWaiting = ({ item }: QueuedParams): boolean =>
  useAppStore
    .getState()
    .agentQueue[item.agentId]?.some(
      (turn) => turn.id === item.itemId && turn.status === 'queued',
    ) === true;

const withdraw = ({ item }: QueuedParams): Promise<void> =>
  useAppStore
    .getState()
    .removeQueuedMessage({ sessionId: item.sessionId, agentId: item.agentId, itemId: item.itemId });

export const messageBothImplementers = async ({ notes }: Params): Promise<MessageOutcome> => {
  const queued: ReadonlyArray<Queued> = notes.map((note) => ({
    ...note,
    itemId: crypto.randomUUID(),
  }));
  const saved = await Promise.all(
    queued.map((item) =>
      useAppStore.getState().enqueueAgentMessage({
        turn: {
          id: item.itemId,
          agentId: item.agentId,
          content: item.content,
          attachments: [],
          override: undefined,
        },
        shouldDropUnsaved: true,
      }),
    ),
  );
  if (saved.some((isSaved) => !isSaved)) {
    await Promise.all(
      queued.flatMap((item, index) => (saved[index] === true ? [withdraw({ item })] : [])),
    );
    return { isSent: false, failure: NOT_SAVED };
  }
  const timer = setTimeout(() => {
    for (const item of queued) {
      void useAppStore
        .getState()
        .drainAgentQueue({ sessionId: item.sessionId, agentId: item.agentId });
    }
  }, SEND_AFTER_MS);
  useAppStore.getState().undoable({
    message: 'Sent to both Implementers',
    conflictMessage: 'An Implementer already read it, so it stays sent.',
    doneMessage: 'Message withdrawn.',
    undo: async () => {
      if (!queued.every((item) => isWaiting({ item }))) {
        return false;
      }
      clearTimeout(timer);
      await Promise.all(queued.map((item) => withdraw({ item })));
      return true;
    },
  });
  return { isSent: true };
};
