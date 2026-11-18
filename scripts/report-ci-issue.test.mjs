import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextIssueBody } from './report-ci-issue.mjs';

const RUN_A = 'https://github.com/acme/ledger-core/actions/runs/1';
const RUN_B = 'https://github.com/acme/ledger-core/actions/runs/2';

describe('nextIssueBody', () => {
  it('opens with the first failure as the latest one and a count of one', () => {
    const body = nextIssueBody({
      previous: null,
      message: 'The perf tests failed on push.',
      runUrl: RUN_A,
      at: '2026-11-18 00:40',
    });
    assert.match(body, /^The perf tests failed on push\.$/m);
    assert.match(body, new RegExp(`^Latest failure: 2026-11-18 00:40 ${RUN_A}$`, 'm'));
    assert.match(body, new RegExp(`^First failure: 2026-11-18 00:40 ${RUN_A}$`, 'm'));
    assert.match(body, /^Failures while open: 1$/m);
  });

  it('keeps the first failure, moves the latest and counts up on the next one', () => {
    const first = nextIssueBody({
      previous: null,
      message: 'm',
      runUrl: RUN_A,
      at: '2026-11-18 00:40',
    });
    const second = nextIssueBody({
      previous: first,
      message: 'The perf tests failed on schedule.',
      runUrl: RUN_B,
      at: '2026-11-18 03:17',
    });
    assert.match(second, /^The perf tests failed on schedule\.$/m);
    assert.match(second, new RegExp(`^Latest failure: 2026-11-18 03:17 ${RUN_B}$`, 'm'));
    assert.match(second, new RegExp(`^First failure: 2026-11-18 00:40 ${RUN_A}$`, 'm'));
    assert.match(second, /^Failures while open: 2$/m);
  });

  it('starts the count over on a body written by hand', () => {
    const body = nextIssueBody({
      previous: 'The nightly perf tests failed.',
      message: 'm',
      runUrl: RUN_B,
      at: '2026-11-18 03:17',
    });
    assert.match(body, /^Failures while open: 1$/m);
  });
});
