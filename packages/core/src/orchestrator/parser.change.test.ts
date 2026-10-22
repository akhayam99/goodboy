import { describe, expect, it } from 'vitest';
import { parseOrchestratorDecision } from './parser';

const wrap = (decision: unknown): string =>
  `<<orchestrator>>${JSON.stringify(decision)}<</orchestrator>>`;

const STEP = {
  name: 'Fix the billing table',
  role: 'implementer',
  promptPrefix: 'Fix the billing table at 390px.',
};

describe('parseOrchestratorDecision with a preset change', () => {
  it('reads the change kind and reason of a next decision', () => {
    const decision = parseOrchestratorDecision({
      raw: wrap({
        action: 'next',
        reason: 'The scout found a table that scrolls sideways.',
        change: { kind: 'added', step: 'Fix the billing table', reason: 'It scrolls at 390px' },
        step: { ...STEP, presetStep: 2 },
      }),
      provider: 'anthropic',
    });

    expect(decision).toMatchObject({
      action: 'next',
      change: { kind: 'added', step: 'Fix the billing table', reason: 'It scrolls at 390px' },
      step: { presetStep: 2 },
    });
  });

  it('reads a skip on a done decision', () => {
    const decision = parseOrchestratorDecision({
      raw: wrap({
        action: 'done',
        reason: 'Everything is centered.',
        change: { kind: 'skipped', step: 'Review', reason: 'Nothing changed after step 2' },
      }),
      provider: 'anthropic',
    });

    expect(decision).toMatchObject({ action: 'done', change: { kind: 'skipped', step: 'Review' } });
  });

  it('drops an unknown change kind and a step number that is not a whole positive number', () => {
    const decision = parseOrchestratorDecision({
      raw: wrap({
        action: 'next',
        reason: 'Next.',
        change: { kind: 'rewrote', step: 'Review', reason: 'x' },
        step: { ...STEP, presetStep: 1.5 },
      }),
      provider: 'anthropic',
    });

    expect(decision).not.toHaveProperty('change');
    expect(decision?.action === 'next' ? decision.step : null).not.toHaveProperty('presetStep');
  });

  it('never carries a change on a blocked decision', () => {
    const decision = parseOrchestratorDecision({
      raw: wrap({
        action: 'blocked',
        reason: 'Needs a call.',
        change: { kind: 'added', step: 'Review', reason: 'x' },
      }),
      provider: 'anthropic',
    });

    expect(decision).not.toHaveProperty('change');
  });
});
