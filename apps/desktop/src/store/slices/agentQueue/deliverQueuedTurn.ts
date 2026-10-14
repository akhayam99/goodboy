import type { SessionId, UserTurnSentVia } from '@goodboy/types';
import { storedToAttachmentInput } from '../../../features/attachments/pendingAttachment';
import { isTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueuedTurn, GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  turn: AgentQueuedTurn;
  sentVia: UserTurnSentVia;
}>;

type QueuedTurnDelivery = 'delivered' | 'held';

export const deliverQueuedTurn = async ({
  set,
  get,
  sessionId,
  turn,
  sentVia,
}: Params): Promise<QueuedTurnDelivery> => {
  const { agentId } = turn;
  let removal: Promise<boolean> | undefined;
  const accept = (): Promise<boolean> => {
    removal ??= (async () => {
      const current = readAgentQueue({ get, agentId });
      if (!current.some((item) => item.id === turn.id)) {
        return true;
      }
      writeAgentQueue({ set, agentId, queue: current.filter((item) => item.id !== turn.id) });
      return persistAgentQueue({ get, agentId });
    })();
    return removal;
  };
  const hold = async (): Promise<void> => {
    const rest = readAgentQueue({ get, agentId }).filter((item) => item.id !== turn.id);
    writeAgentQueue({ set, agentId, queue: [{ ...turn, status: 'queued' }, ...rest] });
    await persistAgentQueue({ get, agentId });
  };
  let isAccepted = false;
  try {
    const result = await get().sendTurn({
      sessionId,
      agentId,
      content: turn.content,
      origin: 'operator',
      ...(turn.attachments.length > 0 && {
        attachments: turn.attachments.map(storedToAttachmentInput),
      }),
      ...(turn.override !== undefined && { override: turn.override }),
      sentVia,
      onStarted: () => {
        isAccepted = true;
        void accept();
      },
    });
    if (result.blockedOverBudget || result.isWriterLeaseDenied === true) {
      await hold();
      return 'held';
    }
    await accept();
    return 'delivered';
  } catch (error) {
    if (isTranscriptOwnedTurnError({ error })) {
      await accept();
      return 'delivered';
    }
    void get().reportError({
      title: "Couldn't send the queued message",
      error,
      sessionId,
    });
    if (isAccepted) {
      await accept();
      return 'delivered';
    }
    await hold();
    return 'held';
  }
};
