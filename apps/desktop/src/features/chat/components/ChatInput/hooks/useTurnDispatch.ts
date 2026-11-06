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
  readonly force?: boolean;
};

export type DispatchOutcome = 'sent' | 'kept' | 'unwritten';

export const useTurnDispatch = ({ sessionId, cleanupSentAttachments }: UseTurnDispatchArgs) => {
  const sendAgentMessage = useAppStore((s) => s.sendAgentMessage);

  const [error, setError] = useState<string | null>(null);

  const dispatchTurn = useCallback(
    async ({
      content,
      atts,
      override,
      agentId,
      force = false,
    }: DispatchTurnParams): Promise<DispatchOutcome> => {
      let attachments: ReadonlyArray<StoredAttachment>;
      try {
        attachments = await Promise.all(atts.map(toStoredAttachment));
      } catch (err) {
        setError(formatError(err));
        return 'unwritten';
      }
      const delivery = await sendAgentMessage({
        sessionId,
        turn: { id: crypto.randomUUID(), agentId, content, attachments, override },
        isForced: force,
      });
      if (delivery.isDelivered) {
        cleanupSentAttachments({ atts, agentId });
        return 'sent';
      }
      if (delivery.failure !== null) {
        setError(delivery.failure);
      }
      return delivery.isUnwritten === true ? 'unwritten' : 'kept';
    },
    [sendAgentMessage, sessionId, cleanupSentAttachments],
  );

  return { dispatchTurn, error, setError };
};
