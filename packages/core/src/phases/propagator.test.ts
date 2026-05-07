import { describe, expect, it } from 'vitest';
import type { ContextSlot, IsoDateTime } from '@kay-am/types';
import { PhaseContextPropagator } from './propagator';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;

function makeSummarizer(summary: string) {
  return {
    async summarizePhaseOutput(_text: string): Promise<string> {
      return summary;
    },
  };
}

const SLOTS: ReadonlyArray<ContextSlot> = [{ key: 'goal', value: 'refactor auth', enabled: true }];

describe('PhaseContextPropagator.buildTransition', () => {
  it('combines summary and serialized slots in carryForwardContext', async () => {
    const propagator = new PhaseContextPropagator({ summarizer: makeSummarizer('phase summary') });
    const result = await propagator.buildTransition({
      fromOrdinal: 0,
      toOrdinal: 1,
      completedPhaseOutput: 'raw output',
      existingSlots: SLOTS,
      at: AT,
    });

    expect(result.fromOrdinal).toBe(0);
    expect(result.toOrdinal).toBe(1);
    expect(result.at).toBe(AT);
    expect(result.carryForwardContext).toContain('phase summary');
    expect(result.carryForwardContext).toContain('refactor auth');
  });

  it('empty summary → slots text present without a leading double-newline', async () => {
    const propagator = new PhaseContextPropagator({ summarizer: makeSummarizer('') });
    const result = await propagator.buildTransition({
      fromOrdinal: 1,
      toOrdinal: 2,
      completedPhaseOutput: 'output',
      existingSlots: SLOTS,
      at: AT,
    });

    expect(result.carryForwardContext).not.toMatch(/^\n\n/);
    expect(result.carryForwardContext).toContain('refactor auth');
  });

  it('no slots → summary joined with serialized slot headers', async () => {
    const propagator = new PhaseContextPropagator({ summarizer: makeSummarizer('only summary') });
    const result = await propagator.buildTransition({
      fromOrdinal: 0,
      toOrdinal: 1,
      completedPhaseOutput: 'output',
      existingSlots: [],
      at: AT,
    });

    expect(result.carryForwardContext).toContain('only summary');
  });

  it('empty summary and no slots → carryForwardContext contains only slot headers', async () => {
    const propagator = new PhaseContextPropagator({ summarizer: makeSummarizer('') });
    const result = await propagator.buildTransition({
      fromOrdinal: 0,
      toOrdinal: 1,
      completedPhaseOutput: '',
      existingSlots: [],
      at: AT,
    });

    expect(result.carryForwardContext).not.toMatch(/^\n\n/);
    expect(result.carryForwardContext.trim().length).toBeGreaterThan(0);
  });
});
