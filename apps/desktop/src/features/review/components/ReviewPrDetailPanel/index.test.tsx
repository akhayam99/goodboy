// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReviewablePr, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  startPrReviewSession: vi.fn(async () => 'session-9' as SessionId),
  openSession: vi.fn(),
  state: {
    sessions: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    sessionExternalTasks: {} as Record<
      string,
      ReadonlyArray<{ provider: string; externalId: string }>
    >,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (
      state: typeof h.state & { startPrReviewSession: typeof h.startPrReviewSession },
    ) => T,
  ) => selector({ ...h.state, startPrReviewSession: h.startPrReviewSession }),
}));

vi.mock('../../../../shared/hooks/useOpenSession', () => ({
  useOpenSession: () => h.openSession,
}));

vi.mock('../../../../shared/components/OpenSessionButton', () => ({
  OpenSessionButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? 'Open session'}</button>
  ),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import { ReviewPrDetailPanel } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const PR: ReviewablePr = {
  id: 'github:41',
  provider: 'github',
  repo: 'acme/web',
  number: 41,
  title: 'Harden webhook retries',
  url: 'https://github.com/acme/web/pull/41',
  author: 'sam',
  authorAvatarUrl: null,
  mine: false,
  reviewRequested: true,
  state: 'open',
  baseBranch: 'main',
  headBranch: 'sam/webhook-retries',
  isDraft: false,
  updatedAt: '2026-07-22T10:00:00Z',
};

beforeEach(() => {
  h.state.sessions = [];
  h.state.sessionExternalTasks = {};
  h.startPrReviewSession.mockClear();
  h.openSession.mockClear();
});

afterEach(cleanup);

describe('ReviewPrDetailPanel', () => {
  it('starts a review session and navigates to it', async () => {
    const onClose = vi.fn();
    render(<ReviewPrDetailPanel pr={PR} workspaceId={WORKSPACE_ID} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Review locally/ }));

    await waitFor(() => {
      expect(h.startPrReviewSession).toHaveBeenCalledWith(WORKSPACE_ID, PR);
      expect(h.openSession).toHaveBeenCalledWith({
        sessionId: 'session-9',
        lens: 'review',
        onOpened: onClose,
      });
    });
  });

  it('offers to open an existing review session instead of spawning a duplicate', () => {
    h.state.sessions = [{ id: 'session-5', workspaceId: WORKSPACE_ID }];
    h.state.sessionExternalTasks = {
      'session-5': [{ provider: 'github', externalId: '41' }],
    };
    render(<ReviewPrDetailPanel pr={PR} workspaceId={WORKSPACE_ID} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Open review session' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Review locally/ })).toBeNull();
  });

  it('never offers merge, close, or edit affordances', () => {
    render(<ReviewPrDetailPanel pr={PR} workspaceId={WORKSPACE_ID} onClose={vi.fn()} />);

    expect(screen.queryByText(/merge/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /close pull request/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });

  it('renders the pull request properties in registry order', () => {
    render(<ReviewPrDetailPanel pr={PR} workspaceId={WORKSPACE_ID} onClose={vi.fn()} />);

    const labels = Array.from(screen.getByTestId('detail-properties').querySelectorAll('dt')).map(
      (node) => node.textContent,
    );

    expect(labels).toEqual(['Base branch', 'Updated']);
  });

  it('keeps the header identity of a GitLab merge request', () => {
    render(
      <ReviewPrDetailPanel
        pr={{ ...PR, provider: 'gitlab' }}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('!41')).toBeDefined();
    expect(screen.getByText('Review requested')).toBeDefined();
    expect(screen.getByText('sam')).toBeDefined();
    expect(screen.getByLabelText('Open in GitLab')).toBeDefined();
  });

  it('shows a hint instead of review actions for own PRs', () => {
    render(
      <ReviewPrDetailPanel
        pr={{ ...PR, mine: true }}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/This is your pull request/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Review locally/ })).toBeNull();
  });
});
