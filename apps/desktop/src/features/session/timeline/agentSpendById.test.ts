import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { agentSpendById } from './agentSpendById';

type FixtureParams = {
  readonly value: unknown;
};

const fixture = <Value>({ value }: FixtureParams): Value => JSON.parse(JSON.stringify(value));

const agentOf = ({ value }: FixtureParams): Agent => fixture<Agent>({ value });

const recordOf = ({ value }: FixtureParams): TelemetryRecord => fixture<TelemetryRecord>({ value });

const idOf = ({ value }: { readonly value: string }): AgentId => fixture<AgentId>({ value });

describe('agentSpendById', () => {
  const parent = agentOf({ value: { id: 'parent', runId: 'run-parent' } });
  const child = agentOf({ value: { id: 'child', parentAgentId: 'parent', runId: 'run-child' } });
  const records = [
    recordOf({ value: { kind: 'turn', runId: 'run-parent', estimatedCostUsd: 0.5 } }),
    recordOf({ value: { kind: 'turn', runId: 'run-child', estimatedCostUsd: 0.25 } }),
    recordOf({ value: { kind: 'summarizer', runId: 'run-parent', estimatedCostUsd: 9 } }),
  ];

  it('rolls a subagent spend into its parent and leaves the summarizer out', () => {
    const spend = agentSpendById({ records, agents: [parent, child], agentRunHistory: {} });

    expect(spend.get(idOf({ value: 'parent' }))).toBe(0.75);
    expect(spend.get(idOf({ value: 'child' }))).toBe(0.25);
  });

  it('counts every run in the history once, the current one included', () => {
    const history: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>> = fixture({
      value: { parent: ['run-old', 'run-parent'] },
    });
    const spend = agentSpendById({
      records: [
        ...records,
        recordOf({ value: { kind: 'turn', runId: 'run-old', estimatedCostUsd: 1 } }),
      ],
      agents: [parent],
      agentRunHistory: history,
    });

    expect(spend.get(idOf({ value: 'parent' }))).toBe(1.5);
  });
});
