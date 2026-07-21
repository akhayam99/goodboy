import type { ContextSlot } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { PREAMBLE_SLOT_TOTAL_BUDGET, SLOT_BUDGETS } from './budgets';
import { serializeSlotsBudgeted } from './slots';

type Params = {
  readonly key: string;
  readonly value: string;
};

const slot = ({ key, value }: Params): ContextSlot => ({ key, value, enabled: true });

describe('serializeSlotsBudgeted', () => {
  it('keeps established decision lines and marks pending compaction', () => {
    const established = '- established decision';
    const latest = '- latest decision';
    const filler = '- x'.repeat(SLOT_BUDGETS.decisions);
    const output = serializeSlotsBudgeted({
      slots: [slot({ key: 'decisions', value: `${established}\n${filler}\n${latest}` })],
    });

    expect(output).toContain(established);
    expect(output).toContain('- ...');
    expect(output).not.toContain(latest);
  });

  it('keeps the most recent file paths when truncating', () => {
    const oldest = 'src/oldest.ts';
    const newest = 'src/newest.ts';
    const filler = `src/${'x'.repeat(SLOT_BUDGETS.files_touched)}.ts`;
    const output = serializeSlotsBudgeted({
      slots: [slot({ key: 'files_touched', value: `${oldest}\n${filler}\n${newest}` })],
    });

    expect(output).not.toContain(oldest);
    expect(output).toContain(newest);
    expect(output).toContain('- ...');
  });

  it('omits files before higher-priority slots when the total is over budget', () => {
    const output = serializeSlotsBudgeted({
      slots: [
        slot({ key: 'goal', value: 'g'.repeat(SLOT_BUDGETS.goal) }),
        slot({ key: 'decisions', value: 'd'.repeat(SLOT_BUDGETS.decisions) }),
        slot({ key: 'open_questions', value: 'q'.repeat(SLOT_BUDGETS.open_questions) }),
        slot({ key: 'files_touched', value: 'f'.repeat(SLOT_BUDGETS.files_touched) }),
        slot({
          key: 'last_output_summary',
          value: 's'.repeat(SLOT_BUDGETS.last_output_summary),
        }),
      ],
    });

    expect(output.length).toBeLessThanOrEqual(PREAMBLE_SLOT_TOTAL_BUDGET);
    expect(output).toContain('## files touched\n(omitted, over budget)');
    expect(output).toContain('q'.repeat(SLOT_BUDGETS.open_questions));
  });
});
