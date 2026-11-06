import { useCallback, useState } from 'react';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { useToast } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import type { RetryRunParams } from '../../../retryRun';
import { buildRetryOverride } from '../buildRetryOverride';
import { findRetrySource } from '../findRetrySource';
import { retryAsksOf } from '../retryAsksOf';
import { missingAttachmentsMessage, readRetryAttachments } from '../readRetryAttachments';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null | undefined;
  readonly events: ReadonlyArray<TurnEvent>;
  readonly worktreePath: string | null;
};

type Result = Readonly<{
  retryingRunId: ProviderRunId | null;
  retryRun: (params: RetryRunParams) => Promise<void>;
}>;

export const useRetryRun = ({ sessionId, agentId, events, worktreePath }: Params): Result => {
  const sendTurn = useAppStore((state) => state.sendTurn);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const [retryingRunId, setRetryingRunId] = useState<ProviderRunId | null>(null);
  const retryRun = useCallback(
    async ({ runId, model }: RetryRunParams) => {
      if (agentId == null) {
        return;
      }
      const source = findRetrySource({ events, runId });
      if (source == null) {
        return;
      }
      setRetryingRunId(runId);
      try {
        const { inputs: attachments, missing } = await readRetryAttachments({
          worktreePath,
          attachments: source.attachments,
        });
        if (missing.length > 0) {
          showToast({ kind: 'warning', message: missingAttachmentsMessage({ missing }) });
        }
        const override = buildRetryOverride({
          provider: source.provider,
          model: model ?? source.model,
        });
        await sendTurn({
          sessionId,
          agentId,
          content: source.content,
          resolvedAsks: retryAsksOf({ events, runId }),
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(override !== undefined ? { override } : {}),
        });
      } catch (error) {
        if (!isReportedError(error)) {
          void reportError({ title: "Couldn't retry the turn", error, sessionId });
        }
      } finally {
        setRetryingRunId(null);
      }
    },
    [agentId, events, reportError, sendTurn, sessionId, showToast, worktreePath],
  );
  return { retryingRunId, retryRun };
};
