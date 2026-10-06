import { describe, expect, it } from 'vitest';
import type { TelemetryKind, TelemetryRecord } from '@goodboy/types';
import { sumSessionCost } from './sumSessionCost';

type Params = {
  readonly kind: TelemetryKind;
  readonly estimatedCostUsd: number;
};

const createRecord = ({ kind, estimatedCostUsd }: Params): TelemetryRecord =>
  ({ kind, estimatedCostUsd }) as TelemetryRecord;

describe('sumSessionCost', () => {
  it('sums turn costs and skips summarizer costs', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 1.25 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 8 }),
      createRecord({ kind: 'turn', estimatedCostUsd: 0.5 }),
    ];

    expect(sumSessionCost(records)).toBe(1.75);
  });

  it('counts Ask answers in the session cost', () => {
    const records = [
      createRecord({ kind: 'turn', estimatedCostUsd: 3.38 }),
      createRecord({ kind: 'ask', estimatedCostUsd: 0.04 }),
      createRecord({ kind: 'summarizer', estimatedCostUsd: 2 }),
    ];

    expect(sumSessionCost(records)).toBeCloseTo(3.42);
  });
});
