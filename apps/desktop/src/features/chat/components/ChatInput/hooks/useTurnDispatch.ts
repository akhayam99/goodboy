import { useCallback, useState } from 'react';
import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { formatError } from '../../../../../shared/lib/errors';
import { toAttachmentInput } from '../lib';
import type { PendingAttachment, QueuedTurn } from '../lib';

type UseTurnDispatchArgs = {
  readonly sessionId: SessionId;
  readonly cleanupSentAttachments: (atts: ReadonlyArray<PendingAttachment>) => void;
};

export function useTurnDispatch({ sessionId, cleanupSentAttachments }: UseTurnDispatchArgs) {
  const sendTurn = useAppStore((s) => s.sendTurn);

  const [error, setError] = useState<string | null>(null);
  const [lastFailedTurn, setLastFailedTurn] = useState<Omit<QueuedTurn, 'id'> | null>(null);

  const dispatchTurn = useCallback(
    async (
      content: string,
      atts: ReadonlyArray<PendingAttachment>,
      override: TurnProviderOverride | undefined,
      agentId: AgentId,
    ) => {
      try {
        await sendTurn({
          sessionId,
          agentId,
          content,
          ...(atts.length > 0 ? { attachments: atts.map(toAttachmentInput) } : {}),
          override,
        });
        setLastFailedTurn(null);
        cleanupSentAttachments(atts);
      } catch (err) {
        setError(formatError(err));
        setLastFailedTurn({ agentId, content, attachments: atts, override });
      }
    },
    [sendTurn, sessionId, cleanupSentAttachments],
  );

  return { dispatchTurn, error, setError, lastFailedTurn, setLastFailedTurn };
}
