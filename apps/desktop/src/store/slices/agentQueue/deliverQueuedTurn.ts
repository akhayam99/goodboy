import type { SessionId, UserTurnSentVia } from '@goodboy/types';
import { toAttachmentInput } from '../../../features/chat/components/ChatInput/lib';
import { isTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import type { SendTurnResult } from '../turn/types';
import type { AgentQueuedTurn, GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  turn: AgentQueuedTurn;
  sentVia: UserTurnSentVia;
}>;

export const deliverQueuedTurn = async ({
  get,
  sessionId,
  turn,
  sentVia,
}: Params): Promise<SendTurnResult | null> => {
  try {
    return await get().sendTurn({
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
  } catch (error) {
    if (!isTranscriptOwnedTurnError({ error })) {
      void get().reportError({
        title: "Couldn't send the queued message",
        error,
        sessionId,
      });
    }
    return null;
  }
};
