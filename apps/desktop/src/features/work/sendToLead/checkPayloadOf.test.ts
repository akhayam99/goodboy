import { describe, expect, it } from 'vitest';
import { checkPayloadOf, type CheckPayload } from './checkPayloadOf';

const PAYLOAD: CheckPayload = {
  name: 'integration-tests',
  detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/1/job/2',
  logTail: 'FAIL src/retry.test.ts\nexpected 2 retries, got 4',
  branch: 'hl/retry-cap',
  prNumber: 418,
  prUrl: null,
  changedPaths: ['src/retry.ts'],
  note: '',
};

describe('checkPayloadOf', () => {
  it('sends the name, the end of the log, the PR and the branch', () => {
    const text = checkPayloadOf({ payload: PAYLOAD });

    expect(text).toContain('The check integration-tests failed.');
    expect(text).toContain('Where: branch hl/retry-cap, PR #418.');
    expect(text).toContain('expected 2 retries, got 4');
    expect(text).not.toContain('Files the PR changes');
  });

  it('sends the name, the link and the PR paths when the host gives no log', () => {
    const text = checkPayloadOf({
      payload: {
        ...PAYLOAD,
        detailsUrl: 'https://gitlab.com/acme/payments-api/-/pipelines/7',
        logTail: null,
      },
    });

    expect(text).toContain('Its page: https://gitlab.com/acme/payments-api/-/pipelines/7');
    expect(text).toContain('Files the PR changes:\n- src/retry.ts');
  });
});
