// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';

vi.mock('../../../../shared/hooks/useNow', () => ({
  useNow: () => Date.now(),
}));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;

import { GithubCard } from './index';

const pr: PullRequestState = {
  number: 42,
  title: 'tiny pr',
  url: 'https://github.com/x/y/pull/42',
  state: 'open',
  checks: 'success',
  reviewDecision: null,
  updatedAt: new Date().toISOString(),
} as unknown as PullRequestState;

afterEach(cleanup);

describe('GithubCard', () => {
  it('renders the three tabs with role tab', () => {
    render(
      <GithubCard
        pr={pr}
        detail={null}
        detailLoading={false}
        detailError={null}
        detailFetchedAt={null}
        branchLastActivity={null}
        onOpenUrl={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: /CI/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Comments/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Review/i })).toBeDefined();
  });

  it('renders a refresh button accessible by label', () => {
    render(
      <GithubCard
        pr={pr}
        detail={null}
        detailLoading={false}
        detailError={null}
        detailFetchedAt={null}
        branchLastActivity={null}
        onOpenUrl={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /refresh github data/i })).toBeDefined();
  });
});
