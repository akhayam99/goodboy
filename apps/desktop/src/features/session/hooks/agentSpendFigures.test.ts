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
import { useLeadTree } from '../../auto/hooks/useLeadTree';
import { aDelegation, aView } from '../../auto/testing/autoViewFixtures';
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

const NESTED = brandId<AgentId>({ value: 'agent-nested' });
const NESTED_RUN = brandId<ProviderRunId>({ value: 'run-nested' });

const BASE_VIEW = aView({
  delegations: [
    aDelegation({ key: 'scout', role: 'scout', state: 'running' }),
    aDelegation({ key: 'nested', role: 'tester', state: 'running' }),
  ],
});

const LEAD_VIEW = { ...BASE_VIEW, tree: { ...BASE_VIEW.tree, rootAgentId: LEAD } };

const NO_QUEUE: Parameters<typeof useLeadTree>[0]['queue'] = [];

const QUEUED: Parameters<typeof useLeadTree>[0]['queued'] = {
  rows: [],
  onEdit: () => undefined,
  onRemove: () => undefined,
};

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
    expect(header.result.current.runUsd).toBe(LEAD_AND_SCOUT_USD);
    expect(rows.result.current.get(LEAD)).toBe(header.result.current.runUsd);
    expect(rows.result.current.get(SCOUT)).toBe(0.125);
  });

  it('keeps the spend of the Lead apart from the total of the run', () => {
    const header = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: LEAD }));
    const scout = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: SCOUT }));
    expect(header.result.current).toEqual({
      ownUsd: 0.75,
      runUsd: LEAD_AND_SCOUT_USD,
      hasHelpers: true,
    });
    expect(scout.result.current).toEqual({ ownUsd: 0.125, runUsd: 0.125, hasHelpers: false });
  });

  it('reads the same in the transcript footer, without the summarizer cost', () => {
    const header = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: LEAD }));
    const footer = renderHook(() => useAgentMetrics({ sessionId: SESSION }));
    expect(footer.result.current.aggregatesByAgentId.get(LEAD)?.estimatedCostUsd).toBe(
      header.result.current.runUsd,
    );
    expect(footer.result.current.aggregatesByAgentId.get(SCOUT)?.estimatedCostUsd).toBe(0.125);
  });

  it('counts a helper of a helper once across the rows of the Lead tree', () => {
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        [SESSION]: [
          ...(state.sessionPhaseRuns[SESSION] ?? []),
          anAgent({
            id: NESTED,
            sessionId: SESSION,
            name: 'Tester',
            runId: NESTED_RUN,
            parentAgentId: SCOUT,
          }),
        ],
      },
      sessionTelemetry: {
        [SESSION]: [
          ...RECORDS,
          recordOf({ id: 't6', runId: NESTED_RUN, kind: 'turn', costUsd: 0.0625 }),
        ],
      },
      autoTreeViews: { [SESSION]: [LEAD_VIEW] },
    }));

    const tree = renderHook(() =>
      useLeadTree({ sessionId: SESSION, rootAgentId: LEAD, queue: NO_QUEUE, queued: QUEUED }),
    );
    const header = renderHook(() => useAgentSpend({ sessionId: SESSION, agentId: LEAD }));

    const rows = tree.result.current.items.flatMap((item) =>
      item.kind === 'agent' ? [[item.agentId, item.spendUsd]] : [],
    );
    expect(rows).toEqual([
      [SCOUT, 0.125],
      [NESTED, 0.0625],
    ]);
    expect(tree.result.current.tree?.totalSpendUsd).toBe(header.result.current.runUsd);
    expect(header.result.current.runUsd).toBe(LEAD_AND_SCOUT_USD + 0.0625);
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
