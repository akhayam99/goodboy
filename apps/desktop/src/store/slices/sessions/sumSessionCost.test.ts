import { describe, expect, it } from 'vitest';
import type { TelemetryKind, TelemetryRecord } from '@goodboy/types';
import { sessionSpendByAgent } from '../../../features/budget/sessionSpendByAgent';
import { sumSessionCost } from './sumSessionCost';

type Params = {
  readonly kind: TelemetryKind;
  readonly estimatedCostUsd: number;
};

const createRecord = ({ kind, estimatedCostUsd }: Params): TelemetryRecord =>
  ({ kind, estimatedCostUsd }) as TelemetryRecord;

describe('sumSessionCost', () => {
  it('sums turn costs and summarizer costs, as the session spend chip does', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 1.25 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 8 }),
      createRecord({ kind: 'turn', estimatedCostUsd: 0.5 }),
    ];

    expect(sumSessionCost(records)).toBe(9.75);
  });

  it('counts Ask answers in the session cost', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 3.38 }),
      createRecord({ kind: 'ask', estimatedCostUsd: 0.04 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 2 }),
    ];

    expect(sumSessionCost(records)).toBeCloseTo(5.42);
  });

  it('agrees with the total the header spend chip shows', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 3.38 }),
      createRecord({ kind: 'ask', estimatedCostUsd: 0.04 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 0.02 }),
    ];
    const breakdown = sessionSpendByAgent({
      records,
      agents: [],
      agentRunHistory: {},
      agentKindOverride: {},
    });

    expect(sumSessionCost(records)).toBe(breakdown.totalUsd);
  });
});
