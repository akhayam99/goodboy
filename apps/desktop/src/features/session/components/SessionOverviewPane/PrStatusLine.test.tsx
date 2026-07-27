// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    openUrl: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { PrStatusLine } from './PrStatusLine';

beforeEach(() => {
  mocks.openUrl.mockClear();
});
afterEach(cleanup);

const basePr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 9304,
  title: 'ship the thing',
  url: 'https://github.com/acme/repo/pull/9304',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'ak/feat-thing',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-07-27T10:00:00.000Z',
  ...over,
});

describe('PrStatusLine', () => {
  it('opens the pull request url when the number is clicked', () => {
    render(<PrStatusLine pr={basePr()} />);
    fireEvent.click(screen.getByRole('button', { name: '#9304' }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/acme/repo/pull/9304');
  });

  it('shows failing checks in danger tone and approved review in muted green', () => {
    render(<PrStatusLine pr={basePr({ checks: 'failure', reviewDecision: 'approved' })} />);
    expect(screen.getByTitle('checks failing')).toBeDefined();
    expect(screen.getByText('approved').className).toContain('text-success/80');
  });

  it('shows changes requested in amber and omits the checks indicator when unknown', () => {
    render(<PrStatusLine pr={basePr({ reviewDecision: 'changes_requested' })} />);
    expect(screen.getByText('changes requested').className).toContain('text-warning');
    expect(screen.queryByTitle('checks failing')).toBeNull();
    expect(screen.queryByTitle('checks passing')).toBeNull();
  });

  it('renders the base and head branches', () => {
    render(<PrStatusLine pr={basePr()} />);
    expect(screen.getByText('main ← ak/feat-thing')).toBeDefined();
  });
});
