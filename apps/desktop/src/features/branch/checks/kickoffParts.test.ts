import { describe, expect, it } from 'vitest';
import { cleanLogText } from './cleanLogText';
import { failedLogsOf } from './failedLogsOf';
import { findingOf } from './findingOf';
import { givenOf } from './givenOf';

const ESC = String.fromCharCode(0x1b);
const LOST = String.fromCharCode(0xfffd);
const stamp = '2026-10-10T09:30:00.7123664Z';

describe('log text', () => {
  it('strips ANSI colors, including an escape that lost its first byte', () => {
    expect(cleanLogText({ text: `${ESC}[32mok${ESC}[0m and ${LOST}[31mfail${LOST}[0m` })).toBe(
      'ok and fail',
    );
  });
  it('drops the job, step and timestamp prefixes and marks a named step once', () => {
    const text = [
      `payments-api\tUNKNOWN STEP\t${stamp} first`,
      `payments-api\tRun tests\t${stamp} second`,
      `payments-api\tRun tests\t${stamp} third`,
      'no prefix here',
    ].join('\n');
    expect(cleanLogText({ text })).toBe('first\n== Run tests\nsecond\nthird\nno prefix here');
  });
  it('drops a prefix whose tabs became spaces', () => {
    expect(cleanLogText({ text: `static-analysis UNKNOWN STEP   ${stamp} hello` })).toBe('hello');
  });
  it('splits the kickoff logs by check and cleans each one', () => {
    const text = [
      'payments-api / test',
      '````text',
      `a\tUNKNOWN STEP\t${stamp} ${ESC}[31mfail${ESC}[0m`,
      '```',
      '````',
      '',
      'notify-relay / test',
      'The log is at this URL; it could not be read here.',
      'https://github.com/harborline/notify-relay/actions/runs/1/job/2',
    ].join('\n');
    expect(failedLogsOf({ text })).toEqual([
      { name: 'payments-api / test', text: 'fail\n```', lineCount: 2 },
      { name: 'notify-relay / test', text: null, lineCount: 0 },
    ]);
  });
});

describe('kickoff facts', () => {
  it('reads the pull request, the head, each check and the paths', () => {
    const given = givenOf({
      text: [
        'Pull request: #318',
        'Head: a13bc4d9e0',
        'Check: payments-api / test',
        'Conclusion: failure',
        'Check URL: https://github.com/harborline/payments-api/actions/runs/31/job/42',
        'Log: Last 4 lines of the failed job, 1 KB',
        'Check: notify-relay / lint',
        'Conclusion: timed_out',
        'Paths:',
        '- src/ledger.ts',
        '- src/ledger.test.ts',
      ].join('\n'),
    });
    expect(given.pullRequest).toBe('#318');
    expect(given.head).toBe('a13bc4d9e0');
    expect(given.checks).toEqual([
      {
        name: 'payments-api / test',
        conclusion: 'failure',
        url: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
        log: 'Last 4 lines of the failed job, 1 KB',
      },
      { name: 'notify-relay / lint', conclusion: 'timed_out', url: null, log: null },
    ]);
    expect(given.paths).toEqual(['src/ledger.ts', 'src/ledger.test.ts']);
  });
});

describe('finding', () => {
  it.each([
    ['## Finding\nCause.\n\n## Proposed fix\nChange it.', 'Cause.'],
    ['Cause.\n\n## Proposed fix\nChange it.', 'Cause.'],
    ['Still looking.', 'Still looking.'],
    ['Chatter\n## Finding\nCause.\n## Proposed fix\nx', 'Cause.'],
    ['```md\n## Finding\nfake\n```\n## Proposed fix\nx', '```md\n## Finding\nfake\n```'],
  ])('reads the finding of %#', (text, expected) => {
    expect(findingOf({ text })).toBe(expected);
  });
});
