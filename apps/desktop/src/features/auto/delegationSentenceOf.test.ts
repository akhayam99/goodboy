import { describe, expect, it } from 'vitest';
import { delegationSentenceOf } from './delegationSentenceOf';

const REQUEST = 'Needs a shell to list the commits of payments-api.';

describe('delegationSentenceOf', () => {
  it('reads the one request of a returned child before its whole summary', () => {
    expect(
      delegationSentenceOf({
        delegation: {
          outcome: 'blocked',
          reason: 'needs_shell',
          result: {
            declared: { summary: `Read the retry suite.\n${REQUEST}` },
            returned: { needs: { kind: 'shell' }, request: REQUEST },
          },
        },
      }),
    ).toBe(REQUEST);
  });

  it('falls back to the summary of an old return, then to the reason in words', () => {
    expect(
      delegationSentenceOf({
        delegation: {
          outcome: 'blocked',
          reason: 'declared_blocked',
          result: { declared: { summary: 'The mount is gone.' } },
        },
      }),
    ).toBe('The mount is gone.');
    expect(
      delegationSentenceOf({
        delegation: { outcome: 'blocked', reason: 'needs_user', result: null },
      }),
    ).toBe('It needs something only you can give.');
  });

  it('never reads a request on a child that did not return', () => {
    expect(
      delegationSentenceOf({
        delegation: {
          outcome: 'failed',
          reason: 'report_missing',
          result: { returned: { needs: null, request: REQUEST } },
        },
      }),
    ).toBe('It ended without writing its report.');
  });
});
