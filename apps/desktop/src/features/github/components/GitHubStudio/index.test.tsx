import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'Show assigned issues.',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

type IssueDetailProps = {
  readonly issue: GithubIssue | null;
};

const h = vi.hoisted(() => ({
  refetch: vi.fn(),
  remoteKind: 'github' as 'github' | null,
  useGithubIssues: vi.fn(),
}));

vi.mock('./useGithubInbox', () => ({ useGithubInbox: () => [] }));
vi.mock('./useGithubIssues', () => ({
  useGithubIssues: h.useGithubIssues,
}));
vi.mock('./InboxList', () => ({ InboxList: () => <div>Pull request inbox</div> }));
vi.mock('./PrDetailPanel', () => ({ PrDetailPanel: () => <div>Pull request detail</div> }));
vi.mock('../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => h.remoteKind,
}));
vi.mock('./GithubIssueDetailPanel', () => ({
  GithubIssueDetailPanel: ({ issue }: IssueDetailProps) => (
    <div>{issue?.title ?? 'No issue detail'}</div>
  ),
}));
vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    headerAccessory,
    children,
  }: {
    headerAccessory?: ReactNode;
    children: (requestClose: () => void) => ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

import { GitHubStudio } from './index';

const renderStudio = () =>
  render(
    <GitHubStudio
      workspaceId={'workspace-1' as WorkspaceId}
      rootPath="/repo"
      workspaceName="Goodboy"
      initialSessionId={'session-1' as SessionId}
      onClose={vi.fn()}
    />,
  );

afterEach(() => {
  cleanup();
  h.remoteKind = 'github';
  h.refetch.mockClear();
  h.useGithubIssues.mockReset();
});

describe('GitHubStudio', () => {
  beforeEach(() => {
    h.useGithubIssues.mockReturnValue({
      groups: [{ key: 'open', label: 'Open', rows: [{ issue: ISSUE, sessionId: null }] }],
      loading: false,
      error: null,
      refetch: h.refetch,
    });
  });

  it('keeps pull requests selected by default', () => {
    renderStudio();

    expect(screen.getByRole('tab', { name: 'Pull requests' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('Pull request inbox')).toBeDefined();
    expect(screen.getByText('Pull request detail')).toBeDefined();
  });

  it('renders grouped assigned issues in the issues tab', () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: 'Issues' }));

    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getAllByText('Add issue dashboard').length).toBeGreaterThan(0);
  });

  it('renders an issues refresh button in the header', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh issues' }));

    expect(h.refetch).toHaveBeenCalledOnce();
  });

  it('renders a neutral disconnected state without a connect action', () => {
    h.remoteKind = null;
    renderStudio();

    expect(screen.getByText('No GitHub remote')).toBeDefined();
    expect(screen.getByText('This workspace does not have a GitHub remote.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(h.useGithubIssues).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      rootPath: '/repo',
      isEnabled: false,
    });
  });
});
