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

  it('budget-compacts oversized slots before rendering the preamble', () => {
    const decisions = Array.from(
      { length: 20 },
      (_, index) => `- decision-${index}-${'x'.repeat(80)}`,
    ).join('\n');
    const out = buildContextPreamble([slot('decisions', decisions)]);
    expect(out).toContain('- ...');
    expect(out).not.toContain('decision-19');
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

describe('buildPriorTurnsBlock', () => {
  it('empty transcripts → empty string', () => {
    expect(buildPriorTurnsBlock([], 1000)).toBe('');
  });

  it('only tool events (no text) → empty string', () => {
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
    expect(buildPriorTurnsBlock(events, 1000)).toBe('');
  });

  it('groups assistant deltas, preserves chronological order', () => {
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: 'hello', at: NOW },
      { kind: 'assistant_text', runId: RUN, delta: 'hi ', at: NOW },
      { kind: 'assistant_text', runId: RUN, delta: 'there', at: NOW },
      { kind: 'user_text', runId: RUN, text: 'bye', at: NOW },
    ];
    const out = buildPriorTurnsBlock(events, 1000);
    expect(out).toContain('prior turns');
    expect(out.indexOf('hello')).toBeLessThan(out.indexOf('hi there'));
    expect(out.indexOf('hi there')).toBeLessThan(out.indexOf('bye'));
  });

  it('renders workflow handoffs in chronological position', () => {
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: 'implement', at: NOW },
      { kind: 'assistant_text', runId: RUN, delta: 'implementation complete', at: NOW },
      {
        kind: 'step_transition',
        runId: RUN,
        fromStep: { ordinal: 0, name: 'Implement' },
        toStep: { ordinal: 1, name: 'Review' },
        carryForwardContext: 'changed `src/auth.ts`',
        at: NOW,
      },
      { kind: 'user_text', runId: RUN, text: 'review', at: NOW },
    ];

    const out = buildPriorTurnsBlock(events, 1000);

    expect(out).toContain('workflow handoff (carried forward): changed `src/auth.ts`');
    expect(out.indexOf('implementation complete')).toBeLessThan(out.indexOf('workflow handoff'));
    expect(out.indexOf('workflow handoff')).toBeLessThan(out.indexOf('review'));
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

    expect(buildPriorTurnsBlock(events, 10)).toBe('');
  });

  it('drops oldest first when over budget', () => {
    const longText = 'x'.repeat(4000);
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: `old-${longText}`, at: NOW },
      { kind: 'user_text', runId: RUN, text: `mid-${longText}`, at: NOW },
      { kind: 'user_text', runId: RUN, text: `new-${longText}`, at: NOW },
    ];
    const out = buildPriorTurnsBlock(events, 1500);
    expect(out).toContain('new-');
    expect(out).not.toContain('old-');
  });

  it('budget too small for any turn → empty', () => {
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: 'x'.repeat(4000), at: NOW },
    ];
    expect(buildPriorTurnsBlock(events, 10)).toBe('');
  });
});

describe('getModelContextWindow', () => {
  it('resolves model-specific windows through cli ids', () => {
    expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000);
    expect(getModelContextWindow('claude-opus-4-6')).toBe(200_000);
    expect(getModelContextWindow('claude-haiku-4-5')).toBe(200_000);
    expect(getModelContextWindow('gpt-5.6-sol')).toBe(1_000_000);
    expect(getModelContextWindow('gpt-5.4')).toBe(400_000);
  });

  it('unknown model → null', () => {
    expect(getModelContextWindow('some-custom-model')).toBeNull();
  });
});
