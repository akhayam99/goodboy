import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isTranscriptOwnedTurnError } from '../../../turn-errors';
import { toAttachmentInputs } from '../../../../attachments/pendingAttachment';
import type { FailedTurn } from '../lib';
import type { PendingAttachment } from '../../../../attachments/pendingAttachment';
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
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null);

  const dispatchTurn = useCallback(
    async ({
      content,
      atts,
      override,
      agentId,
      force = false,
    }: DispatchTurnParams): Promise<SendTurnResult> => {
      try {
        const inputs = atts.length > 0 ? await toAttachmentInputs(atts) : [];
        const result = await sendTurn({
          sessionId,
          agentId,
          content,
          origin: 'operator',
          ...(inputs.length > 0 ? { attachments: inputs } : {}),
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
