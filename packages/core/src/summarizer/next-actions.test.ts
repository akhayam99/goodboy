import { describe, expect, it } from 'vitest';
import type { ContextSlot } from '@kay-am/types';
import type { ContextSlotDelta, SummarizeInput } from './client';
import { inferNextActions, type NextActionsPrState } from './next-actions';

function buildInput(
  turnOutput: string,
  prevSlots: ReadonlyArray<ContextSlot> = [],
): SummarizeInput {
  return { turnInput: 'q', turnOutput, prevSlots };
}

function delta(upserts: Array<{ key: string; value: string }> = []): ContextSlotDelta {
  return { upserts: upserts as ContextSlotDelta['upserts'] };
}

describe('inferNextActions', () => {
  it('suggests planner after scout-only turn', () => {
    const actions = inferNextActions({
      input: buildInput('explored the auth module and mapped its dependencies'),
      delta: delta([{ key: 'last_output_summary', value: 'investigated auth code paths' }]),
      slotsAfter: [],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ id: 'spawn_planner', label: 'start plan', kind: 'planner' });
  });

  it('suggests implementer after plan turn', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan for the new caching layer'),
      delta: delta([{ key: 'last_output_summary', value: 'planned caching design' }]),
      slotsAfter: [],
    });
    expect(actions.find((a) => a.id === 'spawn_implementer')).toBeDefined();
  });

  it('suggests open_pr after implementation turn', () => {
    const actions = inferNextActions({
      input: buildInput('implemented the new endpoint and added tests'),
      delta: delta([{ key: 'last_output_summary', value: 'wrote handler + tests' }]),
      slotsAfter: [],
    });
    expect(actions.find((a) => a.id === 'open_pr')).toBeDefined();
  });

  it('does not suggest open_pr if PR already mentioned', () => {
    const actions = inferNextActions({
      input: buildInput('implemented and opened pr #42'),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions.find((a) => a.id === 'open_pr')).toBeUndefined();
  });

  it('suggests debugger when bug mentioned with topic', () => {
    const actions = inferNextActions({
      input: buildInput('found a bug in auth/session.ts where tokens leak across requests'),
      delta: delta(),
      slotsAfter: [],
    });
    const debug = actions.find((a) => a.id === 'spawn_debugger');
    expect(debug).toBeDefined();
    if (debug && debug.id === 'spawn_debugger') {
      expect(debug.payload?.topic).toMatch(/auth\/session\.ts/);
      expect(debug.label).toContain('start debug on');
    }
  });

  it('caps at 2 actions', () => {
    const actions = inferNextActions({
      input: buildInput(
        'scouted the code, drafted a plan, implemented the change, and found a regression',
      ),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions.length).toBeLessThanOrEqual(2);
  });

  it('returns merge_pr when PR open + checks green', () => {
    const prState: NextActionsPrState = { hasOpenPr: true, checksGreen: true };
    const actions = inferNextActions({
      input: buildInput('CI passed'),
      delta: delta(),
      slotsAfter: [],
      prState,
    });
    expect(actions.find((a) => a.id === 'merge_pr')).toBeDefined();
  });

  it('returns empty when nothing matches', () => {
    const actions = inferNextActions({
      input: buildInput('hello world'),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions).toHaveLength(0);
  });

  it('reads delta upsert values too', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta([{ key: 'last_output_summary', value: 'finished implementation of feature X' }]),
      slotsAfter: [],
    });
    expect(actions.find((a) => a.id === 'open_pr')).toBeDefined();
  });

  it('skips open_pr when prState already has open pr (even without text mention)', () => {
    const prState: NextActionsPrState = { hasOpenPr: true, checksGreen: false };
    const actions = inferNextActions({
      input: buildInput('finished implementation'),
      delta: delta(),
      slotsAfter: [],
      prState,
    });
    expect(actions.find((a) => a.id === 'open_pr')).toBeUndefined();
  });
});
