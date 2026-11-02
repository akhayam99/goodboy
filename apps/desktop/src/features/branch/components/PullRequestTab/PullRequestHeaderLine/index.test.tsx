// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';
import { PullRequestHeaderLine } from '.';

afterEach(cleanup);

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-17T09:00:00.000Z',
  author: 'nadia-p',
};

const VIEW = { number: 318, commits: ['a', 'b', 'c', 'd', 'e'] };

const READINESS = {
  facts: { commentsUnresolved: 6 },
  commentsNeedYou: 4,
  commentsUnread: 2,
};

describe('PullRequestHeaderLine', () => {
  it('says who wants to merge how many commits on the pull request page', () => {
    const { container } = render(
      <PullRequestHeaderLine
        pr={PR}
        host="github"
        view={VIEW}
        readiness={READINESS}
        isThreadsShown={false}
      />,
    );

    expect(container.textContent).toContain('nadia-p wants to merge 5 commits into');
  });

  it('swaps the merge sentence for the thread counts on the comments page', () => {
    const { container } = render(
      <PullRequestHeaderLine
        pr={PR}
        host="github"
        view={VIEW}
        readiness={READINESS}
        isThreadsShown
      />,
    );

    expect(container.textContent).toContain('#318');
    expect(container.textContent).toContain('6 open threads · 4 need you · 2 unread');
    expect(container.textContent).not.toContain('wants to merge');
  });
});
