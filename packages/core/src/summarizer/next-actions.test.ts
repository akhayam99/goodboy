import { describe, expect, it } from 'vitest';
import type { ContextSlot } from '@kay-am/types';
import type { ContextSlotDelta, SummarizeInput } from './client';
import { inferNextActions } from './next-actions';

function buildInput(
  turnOutput: string,
  prevSlots: ReadonlyArray<ContextSlot> = [],
): SummarizeInput {
  return { turnInput: 'q', turnOutput, prevSlots };
}

function delta(upserts: Array<{ key: string; value: string }> = []): ContextSlotDelta {
  return { upserts: upserts as ContextSlotDelta['upserts'] };
}

function slots(map: Record<string, string>): ContextSlot[] {
  return Object.entries(map).map(([key, value]) => ({ key, value, enabled: true }));
}

describe('inferNextActions — trigger gating', () => {
  it('returns [] when no turn output and no slots populated', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions).toEqual([]);
  });

  it('emits the trio after the first turn (turnOutput present)', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan for the caching layer'),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions.map((a) => a.kind)).toEqual(['scout', 'plan', 'implement']);
  });

  it('emits the trio when open_questions has content', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: slots({ open_questions: 'which db driver? which cache layer?' }),
    });
    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.kind)).toEqual(['scout', 'plan', 'implement']);
  });

  it('emits the trio when last_output_summary describes a decision branch', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: slots({ last_output_summary: 'decide between redis and memcached' }),
    });
    expect(actions).toHaveLength(3);
  });
});

describe('inferNextActions — trio shape', () => {
  it('emits exactly 3 actions with stable ids', () => {
    const actions = inferNextActions({
      input: buildInput('explored the auth module'),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions.map((a) => a.id)).toEqual(['next-scout', 'next-plan', 'next-implement']);
  });

  it('uses Italian labels for the trio', () => {
    const actions = inferNextActions({
      input: buildInput('something'),
      delta: delta(),
      slotsAfter: [],
    });
    expect(actions.map((a) => a.label)).toEqual(['Esplora codice', 'Pianifica', 'Implementa']);
  });

  it('embeds open_questions topics into prompts (comma-joined for scout)', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: slots({ open_questions: 'auth flow, session storage, token TTL' }),
    });
    const scout = actions.find((a) => a.kind === 'scout');
    expect(scout?.prompt).toContain('auth flow');
    expect(scout?.prompt).toContain('session storage');
    expect(scout?.prompt).toContain('token TTL');
  });

  it('falls back to last_output_summary nouns when open_questions empty', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: slots({ last_output_summary: 'caching layer authentication module' }),
    });
    const scout = actions.find((a) => a.kind === 'scout');
    expect(scout?.prompt).toMatch(/caching/);
  });

  it('plan and implement prompts use the first topic only', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta(),
      slotsAfter: slots({ open_questions: 'topicA, topicB, topicC' }),
    });
    const plan = actions.find((a) => a.kind === 'plan');
    const impl = actions.find((a) => a.kind === 'implement');
    expect(plan?.prompt).toContain('topicA');
    expect(plan?.prompt).not.toContain('topicB');
    expect(impl?.prompt).toContain('topicA');
    expect(impl?.prompt).not.toContain('topicB');
  });

  it('uses a fallback subject when no topics can be derived', () => {
    const actions = inferNextActions({
      input: buildInput('   '),
      delta: delta(),
      slotsAfter: slots({ open_questions: '   ' }),
    });
    expect(actions).toEqual([]);
  });
});

describe('inferNextActions — pr-state ignored', () => {
  it('pr-state does not change the trio output', () => {
    const actions = inferNextActions({
      input: buildInput('ci passed'),
      delta: delta(),
      slotsAfter: [],
      prState: { hasOpenPr: true, checksGreen: true },
    });
    expect(actions.map((a) => a.kind)).toEqual(['scout', 'plan', 'implement']);
  });
});
