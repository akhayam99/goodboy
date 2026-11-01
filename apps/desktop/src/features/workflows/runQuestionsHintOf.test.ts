// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runQuestionsHintOf } from './runQuestionsHintOf';

describe('runQuestionsHintOf', () => {
  it.each([
    ['budget', 'Raise the limit to answer'],
    ['failure', 'Retry the run to answer'],
    ['operator', 'Continue the run to answer'],
    ['paused', 'Resume the run to answer'],
    ['needs-approval', 'Approve to answer'],
    ['plan-approval', 'Approve the plan to answer'],
    ['preset-change', 'Decide on the preset to answer'],
  ] as const)('names the way forward for a %s stop', (kind, hint) => {
    expect(runQuestionsHintOf({ stop: { kind, message: 'Paused for Northwind' } })).toBe(hint);
  });

  it('falls back to resume when the run carries no stop', () => {
    expect(runQuestionsHintOf({ stop: null })).toBe('Resume the run to answer');
  });
});
