// @vitest-environment node
import type { ContextSlot, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { describe, expect, it, vi } from 'vitest';
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from './preamble';

const NOW = '2026-05-11T00:00:00.000Z' as IsoDateTime;
const RUN = 'run-1' as ProviderRunId;

function slot(key: string, value: string): ContextSlot {
  return { key, value, enabled: true };
}

describe('buildContextPreamble', () => {
  it('emits marker hint even with no slots', () => {
    const out = buildContextPreamble([]);
    expect(out).toContain('context handoff protocol');
    expect(out).not.toContain('## shared context');
  });

  it('renders shared context block when slots present', () => {
    const out = buildContextPreamble([slot('goal', 'ship m4-m6')]);
    expect(out).toContain('## shared context');
    expect(out).toContain('ship m4-m6');
  });

  it('slotFilter drops slots not in allow-list', () => {
    const slots = [slot('goal', 'g'), slot('files_touched', 'a.ts'), slot('decisions', 'd')];
    const out = buildContextPreamble(slots, ['goal', 'decisions']);
    expect(out).toContain('goal');
    expect(out).toContain('## decisions');
    expect(out).not.toContain('a.ts');
  });

  it('drops disabled slots from shared context', () => {
    const disabledDecision: ContextSlot = {
      key: 'decisions',
      value: 'hidden decision',
      enabled: false,
    };
    const out = buildContextPreamble([slot('goal', 'visible goal'), disabledDecision]);

    expect(out).toContain('visible goal');
    expect(out).not.toContain('hidden decision');
  });

  it('empty filter result → no shared context block', () => {
    const out = buildContextPreamble([slot('open_questions', 'q?')], ['goal']);
    expect(out).not.toContain('## shared context');
    expect(out).toContain('context handoff protocol');
  });

  it('budget-compacts oversized slots before rendering the preamble, keeping the newest', () => {
    const decisions = Array.from(
      { length: 20 },
      (_, index) => `- D${20 - index} decision-${19 - index}-${'x'.repeat(80)}`,
    ).join('\n');
    const out = buildContextPreamble([slot('decisions', decisions)]);
    expect(out).toContain('- ...');
    expect(out).toContain('decision-19');
    expect(out).not.toContain('decision-0-');
  });

  it('logs serialized slot sizes in development above 80 percent of the total budget', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const slots = [
      slot('goal', 'g'.repeat(280)),
      slot('files_touched', 'f'.repeat(1_600)),
      slot('decisions', 'd'.repeat(1_200)),
      slot('open_questions', 'q'.repeat(800)),
      slot('last_output_summary', 's'.repeat(2_000)),
    ];
    buildContextPreamble(slots);
    expect(debug).toHaveBeenCalledWith(
      '[context-preamble] serialized slot budget usage',
      expect.objectContaining({
        totalChars: expect.any(Number),
        slotChars: expect.objectContaining({
          goal: expect.any(Number),
          files_touched: expect.any(Number),
          decisions: expect.any(Number),
          open_questions: expect.any(Number),
          last_output_summary: expect.any(Number),
        }),
      }),
    );
    debug.mockRestore();
  });
});

const prior = (transcripts: ReadonlyArray<TurnEvent>, maxTokens: number) =>
  buildPriorTurnsBlock({ transcripts, maxTokens });

const userSays = (text: string): TurnEvent => ({ kind: 'user_text', runId: RUN, text, at: NOW });

const assistantSays = (delta: string): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN,
  delta,
  at: NOW,
});

describe('buildPriorTurnsBlock', () => {
  it('empty transcripts carry nothing and leave nothing out', () => {
    expect(prior([], 1000)).toEqual({ text: '', carried: 0, leftOut: 0, isShortened: false });
  });

  it('only tool events (no text) carry nothing', () => {
    const events: TurnEvent[] = [
      {
        kind: 'tool_call_start',
        runId: RUN,
        toolUseId: 't1',
        toolName: 'Bash',
        input: {},
        at: NOW,
      },
    ];
    expect(prior(events, 1000).text).toBe('');
  });

  it('groups assistant deltas, preserves chronological order and counts every turn', () => {
    const events: TurnEvent[] = [
      userSays('hello'),
      assistantSays('hi '),
      assistantSays('there'),
      userSays('bye'),
    ];
    const out = prior(events, 1000);
    expect(out.text).toContain('prior turns');
    expect(out.text.indexOf('hello')).toBeLessThan(out.text.indexOf('hi there'));
    expect(out.text.indexOf('hi there')).toBeLessThan(out.text.indexOf('bye'));
    expect(out).toMatchObject({ carried: 3, leftOut: 0, isShortened: false });
  });

  it('renders workflow handoffs in chronological position', () => {
    const events: TurnEvent[] = [
      userSays('implement'),
      assistantSays('implementation complete'),
      {
        kind: 'step_transition',
        runId: RUN,
        fromStep: { ordinal: 0, name: 'Implement' },
        toStep: { ordinal: 1, name: 'Review' },
        carryForwardContext: 'changed `src/auth.ts`',
        at: NOW,
      },
      userSays('review'),
    ];

    const out = prior(events, 1000).text;

    expect(out).toContain('workflow handoff (carried forward): changed `src/auth.ts`');
    expect(out.indexOf('implementation complete')).toBeLessThan(out.indexOf('workflow handoff'));
    expect(out.indexOf('workflow handoff')).toBeLessThan(out.indexOf('review'));
  });

  it('always carries the original request and says how many older turns it left out', () => {
    const longText = 'x'.repeat(4000);
    const events: TurnEvent[] = [
      userSays('Reconcile the Harborline ledger export for Northwind'),
      assistantSays(`old-${longText}`),
      userSays(`mid-${longText}`),
      assistantSays(`recent-${longText}`),
      userSays('new question'),
    ];

    const out = prior(events, 1500);

    expect(out.text).toContain('user: Reconcile the Harborline ledger export for Northwind');
    expect(out.text).toContain('new question');
    expect(out.text).not.toContain('old-');
    expect(out.text).toContain('[2 older turns left out]');
    expect(out).toMatchObject({ carried: 3, leftOut: 2 });
    expect(out.text.indexOf('Reconcile')).toBeLessThan(out.text.indexOf('left out'));
    expect(out.text.indexOf('left out')).toBeLessThan(out.text.indexOf('new question'));
  });

  it('shortens a latest message that alone is over the budget, with a marker', () => {
    const events: TurnEvent[] = [
      userSays('Summarize the payments-api incident'),
      assistantSays('Here is the summary.'),
      userSays(`pasted log ${'y'.repeat(60_000)}`),
    ];

    const out = prior(events, 2000);

    expect(out.isShortened).toBe(true);
    expect(out.text).toContain('pasted log');
    expect(out.text).toMatch(/\[shortened: \d+ characters left out\]/);
    expect(out.text.length / 4).toBeLessThanOrEqual(2000 + 20);
    expect(out.text).toContain('Summarize the payments-api incident');
  });

  it('shortens an oversize original request to a quarter of the budget', () => {
    const events: TurnEvent[] = [
      userSays(`spec ${'z'.repeat(40_000)}`),
      assistantSays('Understood.'),
      userSays('go'),
    ];

    const out = prior(events, 2000);

    expect(out.isShortened).toBe(true);
    expect(out.text).toContain('spec zzz');
    expect(out.text).toContain('go');
    expect(out.text.length / 4).toBeLessThanOrEqual(2000 + 20);
  });

  it('a budget too small to carry anything leaves everything out', () => {
    const events: TurnEvent[] = [userSays('x'.repeat(4000))];
    expect(prior(events, 10)).toEqual({ text: '', carried: 0, leftOut: 1, isShortened: false });
  });

  it('applies the prior-turn token budget to workflow handoffs', () => {
    const events: TurnEvent[] = [
      {
        kind: 'step_transition',
        runId: RUN,
        fromStep: { ordinal: 0, name: 'Implement' },
        toStep: { ordinal: 1, name: 'Review' },
        carryForwardContext: 'x'.repeat(4000),
        at: NOW,
      },
    ];

    expect(prior(events, 10).text).toBe('');
  });
});

describe('getModelContextWindow', () => {
  it('resolves model-specific windows through cli ids', () => {
    expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000);
    expect(getModelContextWindow('claude-opus-4-6')).toBe(1_000_000);
    expect(getModelContextWindow('claude-haiku-4-5')).toBe(200_000);
    expect(getModelContextWindow('gpt-5.6-sol')).toBe(272_000);
    expect(getModelContextWindow('gpt-5.5')).toBe(400_000);
  });

  it('unknown model → null', () => {
    expect(getModelContextWindow('some-custom-model')).toBeNull();
  });
});
