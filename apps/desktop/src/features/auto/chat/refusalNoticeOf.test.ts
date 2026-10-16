import { describe, expect, it } from 'vitest';
import { AUTO_REFUSAL_CODES, AUTO_REFUSAL_USER_REASON } from '@goodboy/core';
import { aView } from '../testing/autoViewFixtures';
import { refusalNoticeOf } from './refusalNoticeOf';
import { waitingTextOf } from './waitingTextOf';

describe('the notice of a refused hand over', () => {
  it('names the role that was not started and why, in the user voice', () => {
    expect(
      refusalNoticeOf({
        refusal: { action: 'delegate', code: 'mount_ambiguous', roles: ['implementer'] },
      }),
    ).toBe(
      'Auto tried to start an Implementer. Not started: more than one project fits and it did not say which. Auto is choosing again.',
    );
  });

  it('joins several roles once each and falls back to an agent with none', () => {
    expect(
      refusalNoticeOf({
        refusal: {
          action: 'delegate',
          code: 'budget',
          roles: ['implementer', 'tester', 'implementer'],
        },
      }),
    ).toContain('Auto tried to start Implementer and Tester. Not started: the limit left');
    expect(
      refusalNoticeOf({ refusal: { action: 'block', code: 'spec_invalid', roles: [] } }),
    ).toContain('Auto tried to start an agent. Not started: the request was not valid.');
  });

  it('words a refused answer and a refused finish as what they are', () => {
    expect(
      refusalNoticeOf({ refusal: { action: 'answer', code: 'question_unknown', roles: [] } }),
    ).toBe(
      "Auto's answer to an agent was not sent: it answered a question nobody asked. Auto is choosing again.",
    );
    expect(
      refusalNoticeOf({ refusal: { action: 'finish', code: 'tree_busy', roles: [] } }),
    ).toContain('Auto tried to finish. Not finished: the conversation was busy.');
  });

  it('has a user reason for every refusal code and survives an unknown one', () => {
    for (const code of AUTO_REFUSAL_CODES) {
      expect(AUTO_REFUSAL_USER_REASON[code].length).toBeGreaterThan(0);
    }
    expect(
      refusalNoticeOf({ refusal: { action: 'delegate', code: 'not_a_code', roles: [] } }),
    ).toContain('Not started: Goodboy refused the request.');
  });

  it('takes the wait strip while the refusal waits for Auto, over the reading line', () => {
    const refusal = { action: 'delegate', code: 'mount_missing', roles: ['docs'] };

    expect(waitingTextOf({ view: aView({ phase: 'merging', pendingRefusal: refusal }) })).toBe(
      refusalNoticeOf({ refusal }),
    );
    expect(waitingTextOf({ view: aView({ phase: 'merging' }) })).toBe(
      'Auto is reading the results',
    );
    expect(
      waitingTextOf({ view: aView({ phase: 'deciding', pendingRefusal: refusal }) }),
    ).toBeNull();
  });
});
