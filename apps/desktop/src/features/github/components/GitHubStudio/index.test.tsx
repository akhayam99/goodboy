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
  isGithubAuthenticated: true,
}));

vi.mock('./useGithubInbox', () => ({ useGithubInbox: () => [] }));
vi.mock('./useGithubIssues', () => ({
  useGithubIssues: h.useGithubIssues,
}));
vi.mock('./InboxList', () => ({ InboxList: () => <div>Pull request inbox</div> }));
vi.mock('./PrDetailPanel', () => ({ PrDetailPanel: () => <div>Pull request detail</div> }));
vi.mock('../../../integrations/github/GithubFormBody', () => ({
  GithubFormBody: () => (
    <label htmlFor="github-token-test">
      Personal access token
      <input id="github-token-test" />
    </label>
  ),
}));
vi.mock('../../../worktree/useWorkspaceRemoteHostKind', () => ({
  useWorkspaceRemoteHostKind: () => h.remoteKind,
}));
vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: h.isGithubAuthenticated,
    isResolved: true,
    refresh: vi.fn(async () => undefined),
  }),
}));
vi.mock('./GithubIssueDetailPanel', () => ({
  GithubIssueDetailPanel: ({ issue }: IssueDetailProps) => (
    <div>issue detail: {issue?.title ?? 'none'}</div>
  ),
}));
vi.mock('../../../review/components/ReviewInboxList', () => ({
  ReviewInboxList: ({ provider, scope }: { provider: string; scope: string }) => (
    <div>
      Review inbox {provider} {scope}
    </div>
  ),
}));
vi.mock('../../../review/components/ReviewPrDetailPanel', () => ({
  ReviewPrDetailPanel: () => <div>Review pull request detail</div>,
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

type RenderParams = {
  readonly initialIssueExternalId?: string | null;
};

const renderStudio = ({ initialIssueExternalId = null }: RenderParams = {}) =>
  render(
    <GitHubStudio
      workspaceId={'workspace-1' as WorkspaceId}
      rootPath="/repo"
      workspaceName="Goodboy"
      initialSessionId={'session-1' as SessionId}
      initialIssueExternalId={initialIssueExternalId}
      onClose={vi.fn()}
    />,
  );

afterEach(() => {
  cleanup();
  h.remoteKind = 'github';
  h.isGithubAuthenticated = true;
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
    expect(screen.getByRole('tab', { name: 'Mine' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Pull request inbox')).toBeDefined();
    expect(screen.getByText('Pull request detail')).toBeDefined();
  });

  it('switches to the review inbox for the others and all scopes', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Others' }));
    expect(screen.getByText('Review inbox github others')).toBeDefined();
    expect(screen.getByText('Review pull request detail')).toBeDefined();
    expect(screen.queryByText('Pull request inbox')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(screen.getByText('Review inbox github all')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Mine' }));
    expect(screen.getByText('Pull request inbox')).toBeDefined();
  });

  it('renders grouped assigned issues in the issues tab', () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: 'Issues' }));

    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getAllByText('Add issue dashboard').length).toBeGreaterThan(0);
  });

  it('lands on the requested issue detail page instead of the first issue', () => {
    h.useGithubIssues.mockReturnValue({
      groups: [
        {
          key: 'open',
          label: 'Open',
          rows: [
            { issue: { ...ISSUE, number: 7, title: 'Unrelated issue' }, sessionId: null },
            { issue: ISSUE, sessionId: null },
          ],
        },
      ],
      loading: false,
      error: null,
      refetch: h.refetch,
    });

    renderStudio({ initialIssueExternalId: '42' });

    expect(screen.getByRole('tab', { name: 'Issues' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Pull request detail')).toBeNull();
    expect(screen.getByText(/issue detail: Add issue dashboard/)).toBeDefined();
  });

  it('renders an issues refresh button in the header', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh issues' }));

    expect(h.refetch).toHaveBeenCalledOnce();
  });

  it('renders the remote explanation without token controls', () => {
    h.remoteKind = null;
    renderStudio();

    expect(screen.getByText(/does not have a GitHub remote/i)).toBeDefined();
    expect(screen.queryByLabelText('Personal access token')).toBeNull();
    expect(h.useGithubIssues).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      rootPath: '/repo',
      isEnabled: false,
    });
  });

  it('offers token controls when the GitHub remote exists without authentication', () => {
    h.isGithubAuthenticated = false;

    renderStudio();

    expect(screen.getByLabelText('Personal access token')).toBeDefined();
    expect(screen.queryByText(/does not have a GitHub remote/i)).toBeNull();
  });

  it('offers token controls without a GitHub remote, so the token stays enterable here', () => {
    h.isGithubAuthenticated = false;
    h.remoteKind = null;

    renderStudio();

    expect(screen.getByLabelText('Personal access token')).toBeDefined();
    expect(screen.queryByText(/does not have a GitHub remote/i)).toBeNull();
  });
});
