// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { serviceUsageCardOf } from './serviceUsageCardOf';

const FACTS = { cpuPercent: 12.4, rssBytes: 52_428_800 };

describe('serviceUsageCardOf', () => {
  it('gives the processor and the memory of a running service as rows', () => {
    const card = serviceUsageCardOf({ name: 'payments-api', facts: FACTS, isRunning: true });

    expect(card?.title).toBe('payments-api');
    expect(card?.facts.map((fact) => [fact.label, fact.value])).toEqual([
      ['CPU', '12%'],
      ['Memory', '50 MB'],
    ]);
  });

  it('has no card for a stopped service or one with no reading yet', () => {
    expect(serviceUsageCardOf({ name: 'payments-api', facts: FACTS, isRunning: false })).toBeNull();
    expect(serviceUsageCardOf({ name: 'payments-api', facts: null, isRunning: true })).toBeNull();
  });
});
