import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./useGithubInbox', () => ({ useGithubInbox: () => [] }));
vi.mock('./useGithubIssues', () => ({
  useGithubIssues: () => ({
    groups: [{ key: 'open', label: 'Open', rows: [{ issue: ISSUE, sessionId: null }] }],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('./InboxList', () => ({ InboxList: () => <div>Pull request inbox</div> }));
vi.mock('./PrDetailPanel', () => ({ PrDetailPanel: () => <div>Pull request detail</div> }));
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

afterEach(cleanup);

describe('GitHubStudio', () => {
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
});
