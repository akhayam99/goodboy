// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TelemetryKind,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sumSessionCost } from '../../../store/slices/sessions/sumSessionCost';
import { useAgentSpendById } from '../../workflows/hooks/useAgentSpendById';
import { agentSpendById } from '../timeline/agentSpendById';
import { useAgentMetrics } from './useAgentMetrics';
import { useAgentSpend } from './useAgentSpend';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const SCOUT = brandId<AgentId>({ value: 'agent-scout' });
const LEAD_FIRST_RUN = brandId<ProviderRunId>({ value: 'run-lead-first' });
const LEAD_RUN = brandId<ProviderRunId>({ value: 'run-lead' });
const SCOUT_RUN = brandId<ProviderRunId>({ value: 'run-scout' });
const NEVER_ATTACHED_RUN = brandId<ProviderRunId>({ value: 'run-never-attached' });

type RecordParams = {
  readonly id: string;
  readonly runId: ProviderRunId;
  readonly kind: TelemetryKind;
  readonly costUsd: number;
};

const recordOf = ({ id, runId, kind, costUsd }: RecordParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: id }),
  runId,
  sessionId: SESSION,
  kind,
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  inputTokens: 100,
  outputTokens: 10,
  estimatedCostUsd: costUsd,
  recordedAt: brandId<IsoDateTime>({ value: '2026-11-01T10:00:00.000Z' }),
});

const RECORDS: ReadonlyArray<TelemetryRecord> = [
  recordOf({ id: 't1', runId: LEAD_FIRST_RUN, kind: 'turn', costUsd: 0.25 }),
  recordOf({ id: 't2', runId: LEAD_RUN, kind: 'turn', costUsd: 0.5 }),
  recordOf({ id: 't3', runId: SCOUT_RUN, kind: 'turn', costUsd: 0.125 }),
  recordOf({ id: 't4', runId: LEAD_RUN, kind: 'summarizer', costUsd: 0.0625 }),
  recordOf({ id: 't5', runId: NEVER_ATTACHED_RUN, kind: 'ask', costUsd: 0.03125 }),
];

const LEAD_AND_SCOUT_USD = 0.875;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION]: [
        anAgent({ id: LEAD, sessionId: SESSION, name: 'Lead', runId: LEAD_RUN }),
        anAgent({
          id: SCOUT,
          sessionId: SESSION,
          name: 'Scout',
          runId: SCOUT_RUN,
          parentAgentId: LEAD,
        }),
      ],
    },
    agentRunHistory: { [LEAD]: [LEAD_FIRST_RUN] },
    sessionTelemetry: { [SESSION]: RECORDS },
  });
});

describe('what an agent has spent', () => {
  it('reads the same in the header and in the run rows', () => {
    const header = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: LEAD }));
    const rows = renderHook(() => useAgentSpendById({ sessionId: SESSION }));
    expect(header.result.current).toBe(LEAD_AND_SCOUT_USD);
    expect(rows.result.current.get(LEAD)).toBe(header.result.current);
    expect(rows.result.current.get(SCOUT)).toBe(0.125);
  });

  it('reads the same in the transcript footer, without the summarizer cost', () => {
    const header = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: LEAD }));
    const footer = renderHook(() => useAgentMetrics({ sessionId: SESSION }));
    expect(footer.result.current.aggregatesByAgentId.get(LEAD)?.estimatedCostUsd).toBe(
      header.result.current,
    );
    expect(footer.result.current.aggregatesByAgentId.get(SCOUT)?.estimatedCostUsd).toBe(0.125);
  });

  it('keeps the session total equal to the runs plus the context work and the rest', () => {
    const perRun = agentSpendById({
      records: RECORDS,
      agents: useAppStore.getState().sessionPhaseRuns[SESSION] ?? [],
      agentRunHistory: useAppStore.getState().agentRunHistory,
    });
    const summarizerUsd = RECORDS.filter((record) => record.kind === 'summarizer').reduce(
      (sum, record) => sum + record.estimatedCostUsd,
      0,
    );
    const unattributedUsd = 0.03125;
    expect((perRun.get(LEAD) ?? 0) + summarizerUsd + unattributedUsd).toBe(sumSessionCost(RECORDS));
  });
});
