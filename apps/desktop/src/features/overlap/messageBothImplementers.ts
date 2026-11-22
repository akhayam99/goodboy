import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

export const SEND_AFTER_MS = 10_000;
export const NOT_SAVED = "The message couldn't be saved, so it was not sent.";
export const STILL_QUEUED =
  "The message couldn't be saved. One note stays held in its Implementer's queue; Retry sends the rest.";
export const RECIPIENT_GONE =
  'An Implementer of this overlap is gone, so the message was not sent.';
export const NOT_WITHDRAWN =
  "One note couldn't be withdrawn and stays held in its Implementer's queue.";
export const HELD_FOR_UNDO = 'Waiting for the Undo window to close.';

export type ImplementerNote = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  content: string;
}>;

export type QueuedNote = ImplementerNote & Readonly<{ itemId: string }>;

type Params = {
  readonly notes: ReadonlyArray<QueuedNote>;
};

export type MessageOutcome = Readonly<
  { isSent: true } | { isSent: false; failure: string; canRetry: boolean }
>;

type QueuedParams = {
  readonly item: QueuedNote;
};

const queuedTurnOf = ({ item }: QueuedParams) =>
  useAppStore.getState().agentQueue[item.agentId]?.find((turn) => turn.id === item.itemId);

const isWaiting = ({ item }: QueuedParams): boolean => queuedTurnOf({ item })?.status === 'queued';

const hasRecipient = ({ item }: QueuedParams): boolean =>
  useAppStore
    .getState()
    .sessionPhaseRuns[item.sessionId]?.some((agent) => agent.id === item.agentId) === true;

const withdraw = ({ item }: QueuedParams): Promise<boolean> =>
  useAppStore
    .getState()
    .removeQueuedMessage({ sessionId: item.sessionId, agentId: item.agentId, itemId: item.itemId });

const save = ({ item }: QueuedParams): Promise<boolean> => {
  if (queuedTurnOf({ item }) !== undefined) {
    return Promise.resolve(true);
  }
  return useAppStore.getState().enqueueAgentMessage({
    turn: {
      id: item.itemId,
      agentId: item.agentId,
      content: item.content,
      attachments: [],
      override: undefined,
    },
    shouldDropUnsaved: true,
    hold: { reason: HELD_FOR_UNDO },
  });
};

export const messageBothImplementers = async ({ notes }: Params): Promise<MessageOutcome> => {
  if (!notes.every((item) => hasRecipient({ item }))) {
    return { isSent: false, failure: RECIPIENT_GONE, canRetry: false };
  }
  const saved = await Promise.all(notes.map((item) => save({ item })));
  if (saved.some((isSaved) => !isSaved)) {
    const withdrawn = await Promise.all(
      notes.flatMap((item, index) => (saved[index] === true ? [withdraw({ item })] : [])),
    );
    const failure = withdrawn.every((isWithdrawn) => isWithdrawn) ? NOT_SAVED : STILL_QUEUED;
    return { isSent: false, failure, canRetry: true };
  }
  const timer = setTimeout(() => {
    for (const item of notes) {
      void useAppStore.getState().releaseQueuedHold({
        sessionId: item.sessionId,
        agentId: item.agentId,
        itemId: item.itemId,
      });
    }
  }, SEND_AFTER_MS);
  useAppStore.getState().undoable({
    message: 'Sent to both Implementers',
    conflictMessage: 'An Implementer already read it, so it stays sent.',
    doneMessage: 'Message withdrawn.',
    undo: async () => {
      if (!notes.every((item) => isWaiting({ item }))) {
        return false;
      }
      clearTimeout(timer);
      const withdrawn = await Promise.all(notes.map((item) => withdraw({ item })));
      if (!withdrawn.every((isWithdrawn) => isWithdrawn)) {
        throw new Error(NOT_WITHDRAWN);
      }
      return true;
    },
  });
  return { isSent: true };
};
