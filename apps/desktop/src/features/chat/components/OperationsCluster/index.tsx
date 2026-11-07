import type { RetryRunParams } from '../../retryRun';
import { memo, useMemo, useState } from 'react';
import { MetaRow, tintClasses, WorkNode, type Tone, type WorkNodeState } from '@goodboy/ui';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { transcriptItemsEqual } from '../../utils/transcriptItemEqual';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { permissionFor } from '../../utils/toolStatus';
import { TranscriptCard } from '../TranscriptCards';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { NAMES } from '../../../../shared/utils/names';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { turnSummary } from '../../utils/turnSummary';
import { clusterSummaryOf, type ClusterState } from './clusterSummaryOf';

type Props = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly isInitiallyOpen?: boolean;
  readonly hasAsks?: boolean;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
  readonly onRetryRun?: (params: RetryRunParams) => void;
  readonly retryingRunId?: ProviderRunId | null;
  readonly activeRunId?: ProviderRunId | null;
};

const NODE_STATE_FOR: Record<ClusterState, WorkNodeState> = {
  approval: 'approval',
  running: 'running',
  stopped: 'stopped',
  failed: 'failed',
  done: 'done',
};

const CLUSTER_TONE: Record<ClusterState, Tone> = {
  approval: 'warning',
  running: 'neutral',
  stopped: 'neutral',
  failed: 'neutral',
  done: 'neutral',
};

const CLUSTER_LABEL: Record<ClusterState, string> = {
  approval: NAMES.waitingForPermission,
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  done: 'Done',
};

const ASK_KINDS = new Set<TranscriptItem['kind']>(['permission_request', 'permission_decision']);

const dangerTint = tintClasses('danger');
const successTint = tintClasses('success');

const OperationsClusterView = ({
  items,
  isInitiallyOpen = false,
  hasAsks = true,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
  onRetryRun,
  retryingRunId = null,
  activeRunId,
}: Props) => {
  const [open, setOpen] = useState(isInitiallyOpen);
  const summary = useMemo(() => clusterSummaryOf({ items, activeRunId }), [items, activeRunId]);
  const { state, runningTool, approvalTool, stoppedCount, failedCount, successCount } = summary;
  const elapsedMs = useElapsedMs({
    running: state === 'running',
    startedAt: summary.earliestStartedAt,
    endedAt: state === 'done' || state === 'failed' ? summary.latestEndedAt : null,
  });
  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  const summaryLine = useMemo(() => turnSummary({ steps: items })?.text ?? '', [items]);

  const ariaLabel = `Operations, ${items.length} ${items.length === 1 ? 'item' : 'items'}${
    state === 'approval'
      ? `, waiting for your permission on ${approvalTool!.toolName}`
      : state === 'running'
        ? `, running ${runningTool!.toolName}`
        : state === 'stopped'
          ? `, stopped after ${stoppedCount} operations`
          : failedCount > 0
            ? `, ${successCount} succeeded, ${failedCount} failed`
            : ''
  }`;

  return (
    <TranscriptDisclosure
      tone={CLUSTER_TONE[state]}
      open={open}
      bodyClassName="gap-0.5"
      header={
        <TranscriptRowHeader
          grouped
          tone={CLUSTER_TONE[state]}
          icon={
            <span data-testid="operations-state-icon" data-node-state={state} className="shrink-0">
              <WorkNode
                size="sm"
                state={NODE_STATE_FOR[state]}
                mark={{ kind: 'dot' }}
                label={CLUSTER_LABEL[state]}
              />
            </span>
          }
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={ariaLabel}
          preview={
            state === 'approval' ? (
              <span className="flex min-w-0 items-center gap-2 text-warning">
                <span className="truncate">{NAMES.waitingForPermission}</span>
                <span className="shrink-0 truncate font-mono text-faint-foreground">
                  {approvalTool!.toolName}
                </span>
              </span>
            ) : state === 'running' ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono">{runningTool!.toolName}</span>
                {duration != null && (
                  <span className="shrink-0 tabular-nums text-faint-foreground">{duration}</span>
                )}
              </span>
            ) : state === 'stopped' ? (
              <span className="truncate text-meta text-faint-foreground">
                Stopped after {stoppedCount} {stoppedCount === 1 ? 'operation' : 'operations'}
              </span>
            ) : state === 'failed' ? (
              <MetaRow
                className="tabular-nums"
                items={[
                  <span key="success" className={successTint.text}>
                    {successCount} success
                  </span>,
                  <span key="failed" className={dangerTint.text}>
                    {failedCount} failed
                  </span>,
                ]}
              />
            ) : summaryLine.length > 0 ? (
              <span className="truncate text-meta text-faint-foreground">{summaryLine}</span>
            ) : undefined
          }
          meta={
            state !== 'running' && state !== 'approval' && duration != null ? duration : undefined
          }
        />
      }
    >
      {items
        .filter((item) => hasAsks || !ASK_KINDS.has(item.kind))
        .map((item) => (
          <TranscriptCard
            key={item.key}
            item={item}
            sessionId={sessionId}
            agentId={agentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
            onRetryRun={onRetryRun}
            retryingRunId={retryingRunId}
            activeRunId={activeRunId}
            permission={
              item.kind === 'tool_call'
                ? permissionFor({ items, toolUseId: item.toolUseId })
                : undefined
            }
          />
        ))}
    </TranscriptDisclosure>
  );
};

const propsEqual = (previous: Props, next: Props): boolean =>
  transcriptItemsEqual({ previous: previous.items, next: next.items }) &&
  previous.isInitiallyOpen === next.isInitiallyOpen &&
  previous.hasAsks === next.hasAsks &&
  previous.sessionId === next.sessionId &&
  previous.agentId === next.agentId &&
  previous.workingDir === next.workingDir &&
  previous.onRefreshAuth === next.onRefreshAuth &&
  previous.onOpenDiff === next.onOpenDiff &&
  previous.onRetryRun === next.onRetryRun &&
  previous.retryingRunId === next.retryingRunId &&
  previous.activeRunId === next.activeRunId;

export const OperationsCluster = memo(OperationsClusterView, propsEqual);
