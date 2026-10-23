import { describe, expect, it } from 'vitest';
import { localCheckOf } from './localCheckOf';

const AT = 1_790_000_000_000;

describe('localCheckOf', () => {
  it('records a push that went through as passed', () => {
    expect(localCheckOf({ answer: { error: null }, at: AT })).toEqual({
      outcome: 'passed',
      at: AT,
      message: null,
    });
  });

  it('records a push the pre-push hook declined, with its message', () => {
    expect(
      localCheckOf({ answer: { error: 'pre-push hook declined: lint failed' }, at: AT }),
    ).toEqual({ outcome: 'declined', at: AT, message: 'pre-push hook declined: lint failed' });
  });

  it('records a push a hook manager names as a failed pre-push script', () => {
    expect(
      localCheckOf({ answer: { error: 'husky - pre-push script failed (code 1)' }, at: AT }),
    ).toMatchObject({ outcome: 'declined' });
  });

  it('keeps the last result when the remote pre-receive hook declined the push', () => {
    const error = [
      ' ! [remote rejected] feature/ledger-core -> feature/ledger-core (pre-receive hook declined)',
      "error: failed to push some refs to 'github.com:acme/ledger-core.git'",
    ].join('\n');

    expect(localCheckOf({ answer: { error }, at: AT })).toBeNull();
  });

  it('keeps the last result when the push failed for another reason', () => {
    expect(
      localCheckOf({ answer: { error: 'Could not resolve host: github.com' }, at: AT }),
    ).toBeNull();
  });
});
