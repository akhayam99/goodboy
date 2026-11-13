// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('says the number, the branch, the base and the author, and nothing else', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    expect(container.textContent).toBe('#318hl/fix-duplicate-creditintomainby Nnadia-p');
  });

  it('draws the author as a person chip with the picture slot', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    const chip = container.querySelector('[data-person]');
    expect(chip?.textContent).toBe('Nnadia-p');
    expect(chip?.querySelector('span[aria-hidden]')).not.toBeNull();
  });

  it('leaves the author out when the host names nobody', () => {
    const { container } = render(
      <PullRequestHeaderLine pr={{ ...PR, author: null }} host="github" />,
    );

    expect(container.querySelector('[data-person]')).toBeNull();
  });

  it('draws the state as an icon with its word for a screen reader and a tooltip', () => {
    render(<PullRequestHeaderLine pr={{ ...PR, state: 'merged' }} host="github" />);

    const icon = screen.getByRole('img', { name: 'Merged' });
    expect(icon.getAttribute('data-state')).toBe('merged');
    expect(screen.queryByText('Merged')).toBeNull();
  });

  it('reads the same on every tab, with no thread counts and no merge sentence', () => {
    const { container } = render(<PullRequestHeaderLine pr={PR} host="github" />);

    expect(container.textContent).not.toContain('wants to merge');
    expect(container.textContent).not.toContain('open thread');
  });
});
