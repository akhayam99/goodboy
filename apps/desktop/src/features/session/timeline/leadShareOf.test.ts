// @vitest-environment node

import { describe, expect, it } from 'vitest';
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
import { leadShareOf } from './leadShareOf';
import { leadSpendOf } from './leadSpendOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const SCOUT = brandId<AgentId>({ value: 'agent-scout-ledger-core' });
const IMPLEMENTER = brandId<AgentId>({ value: 'agent-implementer-payments-api' });
const TESTER = brandId<AgentId>({ value: 'agent-tester-notify-relay' });

type RecordParams = {
  readonly runId: string;
  readonly costUsd: number;
  readonly kind?: TelemetryKind;
};

const recordOf = ({ runId, costUsd, kind = 'turn' }: RecordParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: `telemetry-${runId}-${kind}` }),
  runId: brandId<ProviderRunId>({ value: runId }),
  sessionId: SESSION,
  kind,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 12_000,
  outputTokens: 900,
  estimatedCostUsd: costUsd,
  recordedAt: brandId<IsoDateTime>({ value: '2026-11-27T09:00:00.000Z' }),
});

const runIdOf = (value: string) => brandId<ProviderRunId>({ value });

const AGENTS = [
  anAgent({ id: LEAD, sessionId: SESSION, name: 'Lead', runId: runIdOf('run-lead-3') }),
  anAgent({
    id: SCOUT,
    sessionId: SESSION,
    name: 'Scout',
    runId: runIdOf('run-scout'),
    parentAgentId: LEAD,
  }),
  anAgent({
    id: IMPLEMENTER,
    sessionId: SESSION,
    name: 'Implementer',
    runId: runIdOf('run-implementer-2'),
    parentAgentId: LEAD,
  }),
  anAgent({
    id: TESTER,
    sessionId: SESSION,
    name: 'Tester',
    runId: runIdOf('run-tester'),
    parentAgentId: IMPLEMENTER,
  }),
];

const RUN_HISTORY = {
  [LEAD]: [runIdOf('run-lead-1'), runIdOf('run-lead-2')],
  [IMPLEMENTER]: [runIdOf('run-implementer-1')],
};

const HELPER_RECORDS = [
  recordOf({ runId: 'run-scout', costUsd: 0.18 }),
  recordOf({ runId: 'run-implementer-1', costUsd: 1.12 }),
  recordOf({ runId: 'run-implementer-2', costUsd: 0.74 }),
  recordOf({ runId: 'run-tester', costUsd: 0.36 }),
];

type ShareParams = {
  readonly leadTurnsUsd: ReadonlyArray<number>;
};

const shareOfRun = ({ leadTurnsUsd }: ShareParams) => {
  const records = [
    ...leadTurnsUsd.map((costUsd, index) => recordOf({ runId: `run-lead-${index + 1}`, costUsd })),
    recordOf({ runId: 'run-lead-3', costUsd: 5, kind: 'summarizer' }),
    ...HELPER_RECORDS,
  ];
  const spend = leadSpendOf({
    records,
    agents: AGENTS,
    agentRunHistory: RUN_HISTORY,
    agentId: LEAD,
  });
  return leadShareOf({ spend });
};

type SpendParams = {
  readonly ownUsd: number;
  readonly runUsd: number;
};

const shareOf = ({ ownUsd, runUsd }: SpendParams) =>
  leadShareOf({ spend: { ownUsd, runUsd, hasHelpers: true } });

describe('leadShareOf', () => {
  it('flags a Harborline run where the Lead turns cost more than a quarter', () => {
    expect(shareOfRun({ leadTurnsUsd: [0.62, 0.55, 0.43] })).toEqual({
      percent: 40,
      isOverMark: true,
    });
  });

  it('leaves a Harborline run alone when the Lead stays under a quarter', () => {
    expect(shareOfRun({ leadTurnsUsd: [0.14, 0.12, 0.14] })).toEqual({
      percent: 14,
      isOverMark: false,
    });
  });

  it('flags only above a quarter, read from the percent on screen', () => {
    expect(shareOf({ ownUsd: 2.5, runUsd: 10 })).toEqual({ percent: 25, isOverMark: false });
    expect(shareOf({ ownUsd: 2.54, runUsd: 10 })).toEqual({ percent: 25, isOverMark: false });
    expect(shareOf({ ownUsd: 2.6, runUsd: 10 })).toEqual({ percent: 26, isOverMark: true });
  });

  it('never flags a run at or under half a dollar', () => {
    expect(shareOf({ ownUsd: 0.4, runUsd: 0.5 })).toEqual({ percent: 80, isOverMark: false });
    expect(shareOf({ ownUsd: 0.4, runUsd: 0.51 })).toEqual({ percent: 78, isOverMark: true });
  });

  it('has no share for a run that has spent nothing', () => {
    expect(shareOf({ ownUsd: 0, runUsd: 0 })).toBeNull();
  });
});
