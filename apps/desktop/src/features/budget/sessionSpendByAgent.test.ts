import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryKind,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { sessionSpendByAgent } from './sessionSpendByAgent';

const SESSION = 'session-webhooks' as SessionId;
const AT = '2026-10-06T09:00:00.000Z' as IsoDateTime;

type RecordParams = {
  readonly id: string;
  readonly runId: string;
  readonly kind: TelemetryKind;
  readonly costUsd: number;
};

const record = ({ id, runId, kind, costUsd }: RecordParams): TelemetryRecord => ({
  id: id as TelemetryRecordId,
  runId: runId as ProviderRunId,
  sessionId: SESSION,
  kind,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 1,
  outputTokens: 1,
  estimatedCostUsd: costUsd,
  recordedAt: AT,
});

const implementer: Agent = {
  id: 'agent-implementer' as AgentId,
  sessionId: SESSION,
  ordinal: 1,
  name: 'Implementer',
  status: 'running',
  runId: 'run-implementer' as ProviderRunId,
};

describe('sessionSpendByAgent', () => {
  it('shows Ask answers as their own row, never as Other work', () => {
    const breakdown = sessionSpendByAgent({
      records: [
        record({ id: 't1', runId: 'run-implementer', kind: 'turn', costUsd: 2.1 }),
        record({ id: 't2', runId: 'run-ask-1', kind: 'ask', costUsd: 0.04 }),
        record({ id: 't3', runId: 'run-ask-2', kind: 'ask', costUsd: 0.05 }),
      ],
      agents: [implementer],
      agentRunHistory: {},
      agentKindOverride: {},
    });
    expect(breakdown.totalUsd).toBeCloseTo(2.19);
    expect(breakdown.agents.map((row) => [row.name, row.agentId])).toEqual([
      ['Implementer', 'agent-implementer'],
      ['Ask', null],
    ]);
    expect(breakdown.agents[1]?.costUsd).toBeCloseTo(0.09);
  });
});
