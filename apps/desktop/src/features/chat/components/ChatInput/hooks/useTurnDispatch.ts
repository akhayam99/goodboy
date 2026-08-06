import { useCallback, useState } from 'react';
import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { formatError } from '../../../../../shared/lib/errors';
import { isTranscriptOwnedTurnError } from '../../../turn-errors';
import { toAttachmentInput } from '../lib';
import type { PendingAttachment, QueuedTurn } from '../lib';
import type { SendTurnResult } from '../../../../../store/slices/turn/types';

type UseTurnDispatchArgs = {
  readonly sessionId: SessionId;
  readonly cleanupSentAttachments: (atts: ReadonlyArray<PendingAttachment>) => void;
};

export type DispatchTurnParams = {
  readonly content: string;
  readonly atts: ReadonlyArray<PendingAttachment>;
  readonly override: TurnProviderOverride | undefined;
  readonly agentId: AgentId;
  readonly force?: boolean;
};

export const useTurnDispatch = ({ sessionId, cleanupSentAttachments }: UseTurnDispatchArgs) => {
  const sendTurn = useAppStore((s) => s.sendTurn);

  const [error, setError] = useState<string | null>(null);
  const [lastFailedTurn, setLastFailedTurn] = useState<Omit<QueuedTurn, 'id'> | null>(null);

  const dispatchTurn = useCallback(
    async ({
      content,
      atts,
      override,
      agentId,
      force = false,
    }: DispatchTurnParams): Promise<SendTurnResult> => {
      try {
        const result = await sendTurn({
          sessionId,
          agentId,
          content,
          ...(atts.length > 0 ? { attachments: atts.map(toAttachmentInput) } : {}),
          override,
          ...(force ? { force: true } : {}),
        });
        if (result.blockedOverBudget) {
          return result;
        }
        setLastFailedTurn(null);
        cleanupSentAttachments(atts);
        return result;
      } catch (err) {
        if (isTranscriptOwnedTurnError({ error: err })) {
          setError(null);
          setLastFailedTurn(null);
          return { blockedOverBudget: false };
        }
        setError(formatError(err));
        setLastFailedTurn({ agentId, content, attachments: atts, override });
        return { blockedOverBudget: false };
      }
    },
    [sendTurn, sessionId, cleanupSentAttachments],
  );

  return { dispatchTurn, error, setError, lastFailedTurn, setLastFailedTurn };
};
