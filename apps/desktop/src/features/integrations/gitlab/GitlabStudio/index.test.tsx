import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const MR = {
  id: 12,
  iid: 4,
  projectId: 3,
  title: 'Add merge request dashboard',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/4',
  sourceBranch: 'ak/mr-dashboard',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged' as const,
  updatedAt: '2026-07-22T10:00:00Z',
};

vi.mock('./useGitlabIssues', () => ({
  useGitlabIssues: () => ({ groups: [], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('./useGitlabMrs', () => ({
  useGitlabMrs: () => ({
    groups: [{ key: 'acme/web', label: 'acme/web', rows: [MR] }],
    host: 'https://gitlab.com',
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('./IssueInbox', () => ({ IssueInbox: () => <div>Issue inbox</div> }));
vi.mock('./IssueDetailPanel', () => ({ IssueDetailPanel: () => <div>Issue detail</div> }));
vi.mock('./MrDetailPanel', () => ({ MrDetailPanel: () => <div>Merge request detail</div> }));
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

import { GitlabStudio } from './index';

afterEach(cleanup);

describe('GitlabStudio', () => {
  it('keeps issues selected by default', () => {
    render(
      <GitlabStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Issues' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Issue inbox')).toBeDefined();
    expect(screen.getByText('Issue detail')).toBeDefined();
  });

  it('renders grouped assigned merge requests in the merge requests tab', () => {
    render(
      <GitlabStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Merge requests' }));

    expect(screen.getByText('acme/web')).toBeDefined();
    expect(screen.getByText('Add merge request dashboard')).toBeDefined();
    expect(screen.getByText('Merge request detail')).toBeDefined();
  });
});
