import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';

export type TurnOutcome = 'done' | 'stopped' | 'failed';

export type TurnFooterInfo = {
  readonly outcome: TurnOutcome;
  readonly startedAt: IsoDateTime | null;
};

const runIdAndAtOf = (
  item: TranscriptItem,
): { readonly runId: ProviderRunId; readonly at: IsoDateTime } | null => {
  if (item.kind === 'tool_call') {
    return { runId: item.runId, at: item.startedAt };
  }
  if (item.kind === 'usage') {
    return { runId: item.runId, at: item.at };
  }
  if (item.kind === 'permission_request' || item.kind === 'permission_decision') {
    return { runId: item.runId, at: item.at };
  }
  return null;
};

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly activeRunId?: ProviderRunId | null;
};

export const turnFootersFor = ({
  items,
  activeRunId,
}: Params): ReadonlyMap<ProviderRunId, TurnFooterInfo> => {
  const failedRunIds = new Set<ProviderRunId>();
  const doneRunIds = new Set<ProviderRunId>();
  const usageRunIds = new Set<ProviderRunId>();
  const startedAtByRun = new Map<ProviderRunId, IsoDateTime>();

  for (const item of items) {
    if (item.kind === 'usage') {
      usageRunIds.add(item.runId);
    }
    if (item.kind === 'error' && item.runId !== undefined) {
      failedRunIds.add(item.runId);
    }
    if (item.kind === 'done' && item.runId !== undefined) {
      doneRunIds.add(item.runId);
    }
    const timed = runIdAndAtOf(item);
    if (timed === null) {
      continue;
    }
    const existing = startedAtByRun.get(timed.runId);
    if (existing === undefined || timed.at < existing) {
      startedAtByRun.set(timed.runId, timed.at);
    }
  }

  const footers = new Map<ProviderRunId, TurnFooterInfo>();
  for (const runId of usageRunIds) {
    const startedAt = startedAtByRun.get(runId) ?? null;
    if (failedRunIds.has(runId)) {
      footers.set(runId, { outcome: 'failed', startedAt });
      continue;
    }
    if (doneRunIds.has(runId)) {
      footers.set(runId, { outcome: 'done', startedAt });
      continue;
    }
    if (activeRunId !== undefined && (activeRunId === null || activeRunId !== runId)) {
      footers.set(runId, { outcome: 'stopped', startedAt });
      continue;
    }
    footers.set(runId, { outcome: 'done', startedAt });
  }
  return footers;
};
