// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MeasuredTurnSpan,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { agentSpendById } from './agentSpendById';
import { groupTotals, rootsCost, settledTimeSource } from './groupTotals';

const SESSION_ID = 'session-1' as SessionId;
const MINUTE = 60_000;
const START = Date.parse('2026-08-20T09:00:00.000Z');

const agent = ({
  id,
  parentAgentId,
}: {
  readonly id: string;
  readonly parentAgentId?: string;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: id,
  status: 'completed',
  runId: `provider-${id}` as ProviderRunId,
  ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
});

const record = ({ id, usd }: { readonly id: string; readonly usd: number }): TelemetryRecord => ({
  id: `record-${id}` as TelemetryRecordId,
  runId: `provider-${id}` as ProviderRunId,
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  recordedAt: '2026-08-20T09:10:00.000Z' as IsoDateTime,
  inputTokens: 1,
  outputTokens: 1,
  estimatedCostUsd: usd,
});

const span = ({
  id,
  from,
  to,
  provider = 'anthropic',
  model = 'claude-sonnet-5',
}: {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly provider?: MeasuredTurnSpan['provider'];
  readonly model?: string;
}): MeasuredTurnSpan => ({
  agentId: id as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider,
  model,
  effort: null,
  startedAtMs: START + from * MINUTE,
  endedAtMs: START + to * MINUTE,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const AGENTS = [agent({ id: 'lead' }), agent({ id: 'child', parentAgentId: 'lead' })];

const SPEND = agentSpendById({
  records: [record({ id: 'lead', usd: 1 }), record({ id: 'child', usd: 0.25 })],
  agents: AGENTS,
  agentRunHistory: {},
});

const SPANS = [
  span({ id: 'lead', from: 0, to: 4 }),
  span({ id: 'child', from: 2, to: 6, provider: 'codex', model: 'gpt-5.6-sol' }),
];

describe('groupTotals', () => {
  it('counts a child cost once, since the lead already carries it', () => {
    const totals = groupTotals({
      roots: ['lead' as AgentId],
      costUsd: rootsCost({ roots: ['lead' as AgentId], spendByAgentId: SPEND }),
      isSettled: true,
      source: settledTimeSource({ spans: SPANS, agents: AGENTS }),
    });
    expect(totals.costUsd).toBe(1.25);
  });

  it('counts overlapping time once', () => {
    const totals = groupTotals({
      roots: ['lead' as AgentId],
      costUsd: 0,
      isSettled: true,
      source: settledTimeSource({ spans: SPANS, agents: AGENTS }),
    });
    expect(totals.time?.label).toBe('6m');
  });

  it('shows no time while the group is still working', () => {
    const totals = groupTotals({
      roots: ['lead' as AgentId],
      costUsd: 0,
      isSettled: false,
      source: settledTimeSource({ spans: SPANS, agents: AGENTS }),
    });
    expect(totals.time).toBeNull();
  });
});
