// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState, SessionId } from '@goodboy/types';

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
  it('opens the in-app pr lens when the number is clicked', () => {
    const seen: CustomEvent[] = [];
    const listener = (e: Event) => seen.push(e as CustomEvent);
    window.addEventListener('goodboy:open-github-session', listener);
    render(<PrStatusLine pr={basePr()} sessionId={'sess-1' as SessionId} />);
    fireEvent.click(screen.getByRole('button', { name: '#9304' }));
    window.removeEventListener('goodboy:open-github-session', listener);
    expect(seen[0]?.detail).toEqual({ sessionId: 'sess-1', prNumber: 9304 });
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it('keeps the browser as an explicit secondary affordance', () => {
    render(<PrStatusLine pr={basePr()} sessionId={'sess-1' as SessionId} />);
    fireEvent.click(screen.getByRole('link', { name: 'Open in GitHub' }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/acme/repo/pull/9304');
  });

  it('marks failing checks in the danger tone', () => {
    render(<PrStatusLine pr={basePr({ checks: 'failure' })} sessionId={'sess-1' as SessionId} />);
    expect(screen.getByTitle('Checks failing')).toBeDefined();
  });

  it('shows changes requested in amber and omits the checks indicator when unknown', () => {
    render(
      <PrStatusLine
        pr={basePr({ reviewDecision: 'changes_requested' })}
        sessionId={'sess-1' as SessionId}
      />,
    );
    expect(screen.getByText('Changes requested').className).toContain('text-warning');
    expect(screen.queryByTitle('Checks failing')).toBeNull();
    expect(screen.queryByTitle('Checks passing')).toBeNull();
  });

  it('keeps the approved and queued pill states distinct', () => {
    render(<PrStatusLine pr={basePr({ state: 'approved' })} sessionId={'sess-1' as SessionId} />);
    expect(screen.getByText('Approved')).toBeDefined();
    cleanup();
    render(<PrStatusLine pr={basePr({ state: 'queued' })} sessionId={'sess-1' as SessionId} />);
    expect(screen.getByText('Queued')).toBeDefined();
  });

  it('renders the base and head branches', () => {
    render(<PrStatusLine pr={basePr()} sessionId={'sess-1' as SessionId} />);
    expect(screen.getByText('main ← ak/feat-thing')).toBeDefined();
  });
});
