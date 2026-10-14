import { describe, expect, it } from 'vitest';
import { ciFixOutcomeOf } from './ciFixOutcomeOf';

const base = {
  commit: '9e4c1a7',
  checkName: 'payments-api / test',
  checkOutcome: 'running',
  isDismissed: false,
} as const;

describe('ciFixOutcomeOf', () => {
  it('says the fix is on the branch and asks for the push', () => {
    expect(ciFixOutcomeOf({ ...base, state: 'fixed-local' })).toEqual({
      headline: 'payments-api / test is fixed on your branch',
      detail: 'Committed 9e4c1a7 on the branch, not pushed yet. Push it so the check runs again.',
      tone: 'success',
      isPulsing: false,
    });
  });
  it('says the fixer is working while it runs', () => {
    expect(ciFixOutcomeOf({ ...base, state: 'fixing' })).toEqual({
      headline: 'Fixing payments-api / test',
      detail: 'Implementer is applying it on the branch.',
      tone: 'warning',
      isPulsing: true,
    });
  });
  it.each([
    ['running', 'payments-api / test is running again', 'warning'],
    ['passed', 'payments-api / test passed', 'success'],
    ['failed', 'payments-api / test still fails', 'danger'],
  ] as const)('reads the check as %s after the push', (checkOutcome, headline, tone) => {
    const outcome = ciFixOutcomeOf({ ...base, state: 'fixed-pushed', checkOutcome });
    expect(outcome?.headline).toBe(headline);
    expect(outcome?.tone).toBe(tone);
  });
  it('names the check generically when no name is known', () => {
    expect(ciFixOutcomeOf({ ...base, checkName: null, state: 'fixed-local' })?.headline).toBe(
      'The check is fixed on your branch',
    );
  });
  it('gives a failed fix a detail and no headline', () => {
    const outcome = ciFixOutcomeOf({ ...base, state: 'fix-failed' });
    expect(outcome?.headline).toBeNull();
    expect(outcome?.tone).toBe('danger');
  });
  it('says nothing before a fix, except that a proposal was dismissed', () => {
    expect(ciFixOutcomeOf({ ...base, state: 'proposal' })).toBeNull();
    expect(ciFixOutcomeOf({ ...base, state: 'no-fix' })).toBeNull();
    expect(ciFixOutcomeOf({ ...base, state: 'no-fix', isDismissed: true })?.detail).toBe(
      'Dismissed. Analyze again for another proposal.',
    );
  });
});
