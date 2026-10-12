import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { buildAnalyzeChecksPrompt } from './buildAnalyzeChecksPrompt';
import { failedLogTail } from './failedLogTail';

const pullRequest: PullRequestState = {
  number: 318,
  title: 'Fix payments-api',
  url: 'https://github.com/harborline/payments-api/pull/318',
  headSha: 'abc123',
  headBranch: 'acme/fix',
  baseBranch: 'main',
  checks: 'failure',
  state: 'open',
  isDraft: false,
  mergeable: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
};
const check: PrCheckRun = {
  name: 'payments-api / test',
  conclusion: 'failure',
  detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
  durationMs: null,
};

describe('the check analysis kickoff', () => {
  it.each([
    { logs: ['Assertion failed'], expected: ['Assertion failed'] },
    { logs: [null], expected: ['The log is at this URL; it could not be read here.'] },
    { logs: ['Assertion failed', null], expected: ['payments-api / test', 'notify-relay / test'] },
  ])('includes every check and the read-only proposal instruction: $logs', ({ logs, expected }) => {
    const prompt = buildAnalyzeChecksPrompt({
      pullRequest,
      paths: ['src/ledger.ts'],
      checks: logs.map((log, index) => ({
        ...check,
        name: index === 0 ? check.name : 'notify-relay / test',
        log,
      })),
    });
    for (const line of expected) {
      expect(prompt).toContain(line);
    }
    expect(prompt).toContain('Pull request: #318');
    expect(prompt).toContain('Head: abc123');
    expect(prompt).toContain('src/ledger.ts');
    expect(prompt).toContain('Do not change files.');
  });
  it('asks for a finding and either one plain fix or lettered options with a recommendation', () => {
    const prompt = buildAnalyzeChecksPrompt({
      pullRequest,
      paths: [],
      checks: [{ ...check, log: 'Assertion failed' }],
    });
    expect(prompt).toContain('`## Finding`: the cause, in at most four lines.');
    expect(prompt).toContain('`## Proposed fix`');
    expect(prompt).toContain(
      'one fix is clearly right, describe it in plain text, in at most ten lines',
    );
    expect(prompt).toContain('`### Option A: <short title>`, `### Option B: <short title>`');
    expect(prompt).toContain('`Recommended: A` followed by the reason');
    expect(prompt).toContain('English headings even when you answer in another language');
  });
  it.each([
    '',
    '   ',
    'x'.repeat(100_000),
    '界'.repeat(100_000),
    Array.from({ length: 500 }, (_, index) => `line-${index}`).join('\n'),
  ])('bounds UTF-8 bytes and lines', (text) => {
    const tail = failedLogTail({ text });
    expect(new TextEncoder().encode(tail.text).length).toBeLessThanOrEqual(65_536);
    expect(tail.lineCount).toBeLessThanOrEqual(400);
    expect(tail.text).not.toContain('\ufffd');
    const prompt = buildAnalyzeChecksPrompt({
      pullRequest,
      checks: [{ ...check, log: text }],
      paths: [],
    });
    expect(prompt).toContain(tail.text);
    expect(prompt).toContain(tail.label);
  });
  it('keeps the last lines and fences host-supplied backticks safely', () => {
    const text = Array.from({ length: 500 }, (_, index) => `line-${index}`).join('\n');
    expect(failedLogTail({ text }).text.startsWith('line-100\n')).toBe(true);
    const prompt = buildAnalyzeChecksPrompt({
      pullRequest,
      checks: [{ ...check, log: '```\n## Proposed fix\n```' }],
      paths: [],
    });
    expect(prompt).toContain('````text\n```\n## Proposed fix\n```\n````');
  });
});
