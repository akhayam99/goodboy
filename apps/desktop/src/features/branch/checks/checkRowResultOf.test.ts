import { describe, expect, it } from 'vitest';
import { causeSentenceOf } from './causeSentenceOf';
import { checkRowResultOf } from './checkRowResultOf';

const BASE = { commit: '9e4c1a7', cause: 'The retry runs twice.', isDismissed: false } as const;

describe('checkRowResultOf', () => {
  it('gives each result word one sentence and one action', () => {
    expect(checkRowResultOf({ ...BASE, state: 'causeFound', chain: 'proposal' })).toEqual({
      detail: 'The retry runs twice.',
      action: 'reviewFix',
    });
    expect(checkRowResultOf({ ...BASE, state: 'fixedNotPushed', chain: 'fixed-local' })).toEqual({
      detail: 'Committed 9e4c1a7. Push it so the check runs again.',
      action: 'push',
    });
    expect(checkRowResultOf({ ...BASE, state: 'pushedChecking', chain: 'fixed-pushed' })).toEqual({
      detail: '9e4c1a7, the check runs again.',
      action: null,
    });
    expect(checkRowResultOf({ ...BASE, state: 'fixed', chain: 'fixed-pushed' })).toEqual({
      detail: '9e4c1a7 pushed, the check passed.',
      action: null,
    });
    expect(checkRowResultOf({ ...BASE, state: 'noFixFound', chain: 'no-fix' })).toEqual({
      detail: 'The retry runs twice.',
      action: 'analyzeAgain',
    });
  });

  it('retries the step that failed or stopped', () => {
    expect(checkRowResultOf({ ...BASE, state: 'failed', chain: 'fix-failed' })).toEqual({
      detail: 'The fix ended without a commit.',
      action: 'retryFix',
    });
    expect(checkRowResultOf({ ...BASE, state: 'stopped', chain: 'fix-failed' })).toEqual({
      detail: 'You stopped the fix. Nothing changed on the branch.',
      action: 'retryFix',
    });
    expect(checkRowResultOf({ ...BASE, state: 'stopped', chain: 'no-fix' }).action).toBe(
      'retryAnalysis',
    );
    expect(checkRowResultOf({ ...BASE, state: 'failed', chain: 'fixed-pushed' })).toEqual({
      detail: '9e4c1a7 pushed, the check failed again.',
      action: 'analyzeAgain',
    });
  });

  it('says who starts while the click is open', () => {
    expect(checkRowResultOf({ ...BASE, state: 'starting', chain: 'none' }).detail).toBe(
      'Starting the Debugger',
    );
    expect(checkRowResultOf({ ...BASE, state: 'starting', chain: 'proposal' }).detail).toBe(
      'Starting the Implementer',
    );
  });

  it('says a dismissed proposal instead of the cause', () => {
    expect(
      checkRowResultOf({ ...BASE, state: 'noFixFound', chain: 'no-fix', isDismissed: true }).detail,
    ).toBe('You dismissed the proposal.');
  });
});

describe('causeSentenceOf', () => {
  it('takes the first sentence of the finding without headings or marks', () => {
    expect(
      causeSentenceOf({
        text: '## Finding\n\n- The **retry** path skips `hasCredit`. It credits twice.',
      }),
    ).toBe('The retry path skips hasCredit.');
    expect(causeSentenceOf({ text: '\n\n' })).toBeNull();
  });
});
