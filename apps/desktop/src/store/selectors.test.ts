import { describe, expect, it } from 'vitest';
import type { TelemetryRecord, TelemetryKind } from '@goodboy/types';
import { sumSessionCost } from './selectors';

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
});
