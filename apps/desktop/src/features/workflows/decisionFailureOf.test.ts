// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decisionFailureOf } from './decisionFailureOf';

describe('decisionFailureOf', () => {
  it('is null unless the last decision failed', () => {
    expect(decisionFailureOf({ orchestrator: { phase: 'waiting', detail: 'x' } })).toBeNull();
  });

  it('names what broke', () => {
    expect(
      decisionFailureOf({
        orchestrator: { phase: 'failed', detail: ' the orchestrator returned no step. ' },
      }),
    ).toBe('the orchestrator returned no step.');
  });

  it('says no reason was recorded when the stop carried none', () => {
    expect(decisionFailureOf({ orchestrator: { phase: 'failed', detail: null } })).toBe(
      'no reason was recorded.',
    );
    expect(decisionFailureOf({ orchestrator: { phase: 'failed', detail: '  ' } })).toBe(
      'no reason was recorded.',
    );
  });
});
