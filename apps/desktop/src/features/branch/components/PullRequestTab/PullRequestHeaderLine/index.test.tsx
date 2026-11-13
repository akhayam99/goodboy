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
  author: { login: 'nadia-p', avatarUrl: null },
};

describe('PullRequestHeaderLine', () => {
  it('says the number, the branch, the base, the author and when it was opened', () => {
    const { container } = render(
      <PullRequestHeaderLine pr={PR} host="github" openedAt="2020-01-01T09:00:00.000Z" />,
    );

    expect(container.textContent).toMatch(
      /^#318·hl\/fix-duplicate-creditintomain·Nnadia-popened it\d+d ago$/,
    );
  });

  it('sets the number and both branches in mono', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    const mono = [...container.querySelectorAll('.text-code')].map((node) => node.textContent);
    expect(mono).toEqual(['#318', 'hl/fix-duplicate-credit', 'main']);
  });

  it('draws the author as a person chip with the picture slot', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    const chip = container.querySelector('[data-person]');
    expect(chip?.textContent).toBe('Nnadia-p');
    expect(chip?.querySelector('span[aria-hidden]')).not.toBeNull();
  });

  it('leaves the author and the age out when the host names nobody', () => {
    const { container } = render(
      <PullRequestHeaderLine
        pr={{ ...PR, author: null }}
        host="github"
        openedAt="2020-01-01T09:00:00.000Z"
      />,
    );

    expect(container.querySelector('[data-person]')).toBeNull();
    expect(container.textContent).not.toContain('opened it');
  });

  it('leaves the state to the title row, with no thread counts and no merge sentence', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    expect(container.querySelector('[data-slot="branch-state"]')).toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).not.toContain('wants to merge');
    expect(container.textContent).not.toContain('open thread');
  });
});
