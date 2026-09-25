import type { SessionId, UserTurnSentVia } from '@goodboy/types';
import { toAttachmentInput } from '../../../features/chat/components/ChatInput/lib';
import { isTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import type { AgentQueuedTurn, GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  turn: AgentQueuedTurn;
  sentVia: UserTurnSentVia;
}>;

type QueuedTurnDelivery = 'delivered' | 'held';

export const deliverQueuedTurn = async ({
  get,
  sessionId,
  turn,
  sentVia,
}: Params): Promise<QueuedTurnDelivery> => {
  try {
    const result = await get().sendTurn({
      sessionId,
      agentId: turn.agentId,
      content: turn.content,
      origin: 'operator',
      ...(turn.attachments.length > 0 && {
        attachments: turn.attachments.map(toAttachmentInput),
      }),
      ...(turn.override !== undefined && { override: turn.override }),
      sentVia,
    });
    return result.blockedOverBudget || result.isWriterLeaseDenied === true ? 'held' : 'delivered';
  } catch (error) {
    if (isTranscriptOwnedTurnError({ error })) {
      return 'delivered';
    }
    void get().reportError({
      title: "Couldn't send the queued message",
      error,
      sessionId,
    });
    return 'held';
  }
};
