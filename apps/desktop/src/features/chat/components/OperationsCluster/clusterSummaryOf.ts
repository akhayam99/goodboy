import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { permissionFor, toolStatus } from '../../utils/toolStatus';

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

export type ClusterState = 'approval' | 'running' | 'stopped' | 'failed' | 'done';

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

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly activeRunId?: ProviderRunId | null;
};

export const clusterSummaryOf = ({ items, activeRunId }: Params): ClusterSummary => {
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
