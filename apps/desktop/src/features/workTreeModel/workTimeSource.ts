import { createContext } from 'react';
import { unionDurationMs, type DurationHistory, type TimeInterval } from '@goodboy/core';
import type { AgentId, MeasuredTurnSpan } from '@goodboy/types';

export type WorkTimeSource = {
  readonly nowMs: number;
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly history: DurationHistory | null;
  readonly liveStartMs: ReadonlyMap<string, number>;
  readonly childrenOf: ReadonlyMap<string, ReadonlyArray<AgentId>>;
};

export const WorkTimeContext = createContext<WorkTimeSource | null>(null);

type FamilyParams = {
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly source: WorkTimeSource;
};

const familyOf = ({ agentIds, source }: FamilyParams): ReadonlySet<string> => {
  const family = new Set<string>();
  const pending: Array<string> = [...agentIds];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (family.has(next)) {
      continue;
    }
    family.add(next);
    pending.push(...(source.childrenOf.get(next) ?? []));
  }
  return family;
};

export type ActiveTime = {
  readonly activeMs: number;
  readonly isLive: boolean;
  readonly hasStarted: boolean;
};

export const familyActiveTime = ({ agentIds, source }: FamilyParams): ActiveTime => {
  const family = familyOf({ agentIds, source });
  const intervals: Array<TimeInterval> = [];
  for (const span of source.spans) {
    if (family.has(span.agentId)) {
      intervals.push({ startMs: span.startedAtMs, endMs: span.endedAtMs });
    }
  }
  let isLive = false;
  for (const agentId of family) {
    const startMs = source.liveStartMs.get(agentId);
    if (startMs === undefined) {
      continue;
    }
    isLive = true;
    intervals.push({ startMs, endMs: Math.max(startMs, source.nowMs) });
  }
  return {
    activeMs: unionDurationMs({ intervals }),
    isLive,
    hasStarted: isLive || intervals.length > 0,
  };
};
