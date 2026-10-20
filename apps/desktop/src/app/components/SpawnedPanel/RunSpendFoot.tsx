import { useEffect } from 'react';
import { formatUsd } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore, useRunSpendUsd } from '../../../store';
import { RunSpendLimitPopover } from '../../../features/workflows/components/RunSpendLimitPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const RunSpendFoot = ({ sessionId, run }: Props) => {
  const spentUsd = useRunSpendUsd(sessionId, run.id);
  const loadSessionTelemetry = useAppStore((state) => state.loadSessionTelemetry);
  const isArchived = run.discardedAt != null;
  const hasSpent = spentUsd > 0;

  useEffect(() => {
    void loadSessionTelemetry(sessionId);
  }, [loadSessionTelemetry, sessionId]);

  return (
    <div
      data-run-spend-foot=""
      className="flex h-8 shrink-0 items-center gap-2 text-ui text-muted-foreground"
    >
      {isArchived ? null : <RunSpendLimitPopover sessionId={sessionId} run={run} variant="foot" />}
      {isArchived || !hasSpent ? null : (
        <span aria-hidden className="text-faint-foreground">
          ·
        </span>
      )}
      {hasSpent ? <span className="tabular-nums">{`${formatUsd(spentUsd)} spent`}</span> : null}
    </div>
  );
};
