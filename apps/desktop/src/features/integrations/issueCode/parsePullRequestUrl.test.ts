// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePullRequestUrl } from './parsePullRequestUrl';

const PULL = 'https://github.com/harborline/payments-api/pull/318';

describe('parsePullRequestUrl', () => {
  it.each([
    PULL,
    `${PULL}/`,
    `${PULL}/files`,
    `${PULL}/commits/3f2a1b9`,
    `${PULL}#discussion_r1`,
    `${PULL}/files#diff-abc`,
    `${PULL}?notification_referrer_id=1`,
    `  ${PULL}  `,
    'https://www.github.com/harborline/payments-api/pull/318',
    'HTTPS://GitHub.com/harborline/payments-api/pull/318',
  ])('reads the pull request out of %s', (input) => {
    expect(parsePullRequestUrl(input)).toEqual({
      repo: 'harborline/payments-api',
      number: 318,
      url: PULL,
    });
  });

  it.each([
    ['a GitHub issue', 'https://github.com/harborline/payments-api/issues/318'],
    ['a GitHub repository', 'https://github.com/harborline/payments-api'],
    ['a pull request with no number', 'https://github.com/harborline/payments-api/pull/'],
    ['a pull list', 'https://github.com/harborline/payments-api/pulls'],
    ['a GitLab merge request', 'https://gitlab.com/harborline/payments-api/-/merge_requests/42'],
    ['a Bitbucket pull request', 'https://bitbucket.org/harborline/payments-api/pull-requests/42'],
    ['another host with a pull path', 'https://example.com/harborline/payments-api/pull/318'],
    ['an issue code', 'HBL-412'],
    ['a number', '#318'],
    ['plain text', 'retried webhooks'],
    ['an empty string', '   '],
  ])('leaves %s to the issue lookup', (_name, input) => {
    expect(parsePullRequestUrl(input)).toBeNull();
  });
});
