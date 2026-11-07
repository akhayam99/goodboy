import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  toStoredAttachment,
  type PendingAttachment,
  type StoredAttachment,
} from '../../../../attachments/pendingAttachment';
import type { CleanupSentParams } from './useAttachments';

type UseTurnDispatchArgs = {
  readonly sessionId: SessionId;
  readonly cleanupSentAttachments: (params: CleanupSentParams) => void;
};

export type DispatchTurnParams = {
  readonly content: string;
  readonly atts: ReadonlyArray<PendingAttachment>;
  readonly override: TurnProviderOverride | undefined;
  readonly agentId: AgentId;
  readonly draftAgentId: AgentId;
  readonly force?: boolean;
};

export type DispatchOutcome = 'sent' | 'kept' | 'unwritten';

const NOT_DELIVERED = 'The message was not delivered. It is back in the box.';

export const useTurnDispatch = ({ sessionId, cleanupSentAttachments }: UseTurnDispatchArgs) => {
  const sendAgentMessage = useAppStore((s) => s.sendAgentMessage);
  const takeQueuedMessage = useAppStore((s) => s.takeQueuedMessage);

  const [error, setError] = useState<string | null>(null);

  const dispatchTurn = useCallback(
    async ({
      content,
      atts,
      override,
      agentId,
      draftAgentId,
      force = false,
    }: DispatchTurnParams): Promise<DispatchOutcome> => {
      let attachments: ReadonlyArray<StoredAttachment>;
      try {
        attachments = await Promise.all(atts.map(toStoredAttachment));
      } catch (err) {
        setError(formatError(err));
        return 'unwritten';
      }
      const turnId = crypto.randomUUID();
      const delivery = await sendAgentMessage({
        sessionId,
        turn: { id: turnId, agentId, content, attachments, override },
        isForced: force,
      });
      if (delivery.isDelivered) {
        cleanupSentAttachments({ atts, agentId: draftAgentId });
        return 'sent';
      }
      if (delivery.failure !== null) {
        setError(delivery.failure);
      }
      if (delivery.isUnwritten === true) {
        return 'unwritten';
      }
      if (agentId === draftAgentId) {
        return 'kept';
      }
      const parked = takeQueuedMessage({ sessionId, agentId, itemId: turnId });
      if (parked === null) {
        return 'kept';
      }
      setError(delivery.failure ?? parked.hold?.reason ?? NOT_DELIVERED);
      return 'unwritten';
    },
    [sendAgentMessage, takeQueuedMessage, sessionId, cleanupSentAttachments],
  );

  return { dispatchTurn, error, setError };
};
