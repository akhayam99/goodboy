import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GithubIssue, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    session: { id: 'session-42', goal: 'GitHub issue #42: Add issue dashboard' },
  })),
  loadSetting: vi.fn(async () => null),
  showToast: vi.fn(),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(
    selector: (
      state: typeof h.store & {
        createSession: typeof h.createSession;
        loadSetting: typeof h.loadSetting;
      },
    ) => T,
  ) => selector({ ...h.store, createSession: h.createSession, loadSetting: h.loadSetting }),
}));
vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));
vi.mock('../../../../worktree/useBranchConflict', () => ({ useBranchConflict: () => null }));
vi.mock('../../../../worktree/worktree', () => ({ removeWorktree: vi.fn() }));

import { GithubIssueDetailPanel } from './index';

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'Show assigned issues in GitHub Studio.',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

beforeEach(() => {
  h.createSession.mockClear();
  h.loadSetting.mockClear();
  h.showToast.mockClear();
});

afterEach(cleanup);

describe('GithubIssueDetailPanel', () => {
  it('launches a session linked to the selected GitHub issue', async () => {
    render(
      <GithubIssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        (screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement).value,
      ).toBe('GitHub issue #42: Add issue dashboard\n\nShow assigned issues in GitHub Studio.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Launch session' }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        branchSlug: '42-add-issue-dashboard',
        externalTask: {
          provider: 'github',
          externalId: '42',
          identifier: '#42',
          url: ISSUE.url,
          title: ISSUE.title,
        },
      }),
    );
  });

  it('surfaces the last-updated timestamp in the metadata rail', () => {
    render(
      <GithubIssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText(/\dd ago/)).toBeDefined();
  });
});
