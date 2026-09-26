import type { RetryRunParams } from '../../retryRun';
import { memo, useMemo, useState } from 'react';
import { cn, MetaRow, tintClasses, WorkNode, type Tone, type WorkNodeState } from '@goodboy/ui';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { transcriptItemsEqual } from '../../utils/transcriptItemEqual';
import { formatDuration } from '../../utils/format-duration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { permissionFor, toolStatus } from '../../utils/toolStatus';
import { TranscriptCard } from '../TranscriptCards';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
  readonly onRetryRun?: (params: RetryRunParams) => void;
  readonly retryingRunId?: ProviderRunId | null;
  readonly activeRunId?: ProviderRunId | null;
};

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

type ClusterState = 'approval' | 'running' | 'stopped' | 'failed' | 'done';

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
  approval: 'Waiting for your approval',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  done: 'Done',
};

const operationsTint = tintClasses('neutral');
const dangerTint = tintClasses('danger');
const successTint = tintClasses('success');

type ClusterSummary = {
  readonly state: ClusterState;
  readonly runningTool: ToolItem | null;
  readonly approvalTool: ToolItem | null;
  readonly stoppedCount: number;
  readonly failedCount: number;
  readonly successCount: number;
  readonly earliestStartedAt: IsoDateTime | null;
  readonly latestEndedAt: IsoDateTime | null;
};

type SummarizeParams = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly activeRunId?: ProviderRunId | null;
};

const summarize = ({ items, activeRunId }: SummarizeParams): ClusterSummary => {
  let runningTool: ToolItem | null = null;
  let approvalTool: ToolItem | null = null;
  let stoppedCount = 0;
  let failedCount = 0;
  let successCount = 0;
  let earliestStartedAt: IsoDateTime | null = null;
  let latestEndedAt: IsoDateTime | null = null;

  for (const item of items) {
    if (item.kind !== 'tool_call') {
      continue;
    }
    if (earliestStartedAt === null || item.startedAt < earliestStartedAt) {
      earliestStartedAt = item.startedAt;
    }
    if (item.endedAt !== null && (latestEndedAt === null || item.endedAt > latestEndedAt)) {
      latestEndedAt = item.endedAt;
    }
    const permission = permissionFor({ items, toolUseId: item.toolUseId });
    const status = toolStatus({ item, activeRunId, permission });
    if (status === 'running') {
      runningTool = item;
      continue;
    }
    if (status === 'approval') {
      approvalTool = item;
      continue;
    }
    if (status === 'stopped') {
      stoppedCount += 1;
      continue;
    }
    if (status === 'failed' || status === 'denied') {
      failedCount += 1;
      continue;
    }
    successCount += 1;
  }

  const state: ClusterState =
    approvalTool != null
      ? 'approval'
      : runningTool != null
        ? 'running'
        : stoppedCount > 0
          ? 'stopped'
          : failedCount > 0
            ? 'failed'
            : 'done';

  return {
    state,
    runningTool,
    approvalTool,
    stoppedCount,
    failedCount,
    successCount,
    earliestStartedAt,
    latestEndedAt,
  };
};

const OperationsClusterView = ({
  items,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
  onRetryRun,
  retryingRunId = null,
  activeRunId,
}: Props) => {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => summarize({ items, activeRunId }), [items, activeRunId]);
  const { state, runningTool, approvalTool, stoppedCount, failedCount, successCount } = summary;
  const elapsedMs = useElapsedMs({
    running: state === 'running',
    startedAt: summary.earliestStartedAt,
    endedAt: state === 'done' || state === 'failed' ? summary.latestEndedAt : null,
  });
  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  const summaryLine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const name =
        item.kind === 'tool_call' ? item.toolName : item.kind === 'file_edit' ? 'edit' : item.kind;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => `${count} ${name}`).join(' · ');
  }, [items]);

  const ariaLabel = `Operations, ${items.length} ${items.length === 1 ? 'item' : 'items'}${
    state === 'approval'
      ? `, waiting for your approval on ${approvalTool!.toolName}`
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
          eyebrow="operations"
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={ariaLabel}
          badge={
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 text-2xs tabular-nums text-muted-foreground',
                operationsTint.bg,
              )}
            >
              {items.length}
            </span>
          }
          preview={
            state === 'approval' ? (
              <span className="flex min-w-0 items-center gap-1.5 text-warning">
                <span className="truncate">Waiting for your approval</span>
                <span className="shrink-0 truncate font-mono text-faint-foreground">
                  {approvalTool!.toolName}
                </span>
              </span>
            ) : state === 'running' ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono">{runningTool!.toolName}</span>
                {duration != null && (
                  <span className="shrink-0 font-mono tabular-nums text-faint-foreground">
                    {duration}
                  </span>
                )}
              </span>
            ) : state === 'stopped' ? (
              <span className="truncate text-2xs text-faint-foreground">
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
              <span className="truncate text-2xs text-faint-foreground">{summaryLine}</span>
            ) : undefined
          }
          meta={
            state !== 'running' && state !== 'approval' && duration != null ? duration : undefined
          }
        />
      }
    >
      {items.map((item) => (
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
  previous.sessionId === next.sessionId &&
  previous.agentId === next.agentId &&
  previous.workingDir === next.workingDir &&
  previous.onRefreshAuth === next.onRefreshAuth &&
  previous.onOpenDiff === next.onOpenDiff &&
  previous.onRetryRun === next.onRetryRun &&
  previous.retryingRunId === next.retryingRunId &&
  previous.activeRunId === next.activeRunId;

export const OperationsCluster = memo(OperationsClusterView, propsEqual);
