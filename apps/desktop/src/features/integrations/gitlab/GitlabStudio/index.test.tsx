import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const h = vi.hoisted(() => ({
  isConnected: true,
  useGitlabIssues: vi.fn(),
  useGitlabMrs: vi.fn(),
}));

vi.mock('./useGitlabIssues', () => ({
  useGitlabIssues: h.useGitlabIssues,
}));
vi.mock('./useGitlabMrs', () => ({
  useGitlabMrs: h.useGitlabMrs,
}));
vi.mock('./IssueInbox', () => ({ IssueInbox: () => <div>Issue inbox</div> }));
vi.mock('./IssueDetailPanel', () => ({ IssueDetailPanel: () => <div>Issue detail</div> }));
vi.mock('./MrDetailPanel', () => ({ MrDetailPanel: () => <div>Merge request detail</div> }));
vi.mock('../../../review/components/ReviewInboxList', () => ({
  ReviewInboxList: ({ provider, scope }: { provider: string; scope: string }) => (
    <div>
      Review inbox {provider} {scope}
    </div>
  ),
}));
vi.mock('../../../review/components/ReviewPrDetailPanel', () => ({
  ReviewPrDetailPanel: () => <div>Review merge request detail</div>,
}));
vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: { workspaceIntegrations: Record<string, Array<{ provider: string }>> }) => T,
  ) =>
    selector({
      workspaceIntegrations: h.isConnected ? { 'workspace-1': [{ provider: 'gitlab' }] } : {},
    }),
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

import { GitlabStudio } from './index';

beforeEach(() => {
  h.isConnected = true;
  h.useGitlabIssues.mockReturnValue({
    groups: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  h.useGitlabMrs.mockReturnValue({
    groups: [{ key: 'acme/web', label: 'acme/web', rows: [MR] }],
    host: 'https://gitlab.com',
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  h.useGitlabIssues.mockReset();
  h.useGitlabMrs.mockReset();
});

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

    expect(screen.getByRole('tab', { name: 'Mine' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('acme/web')).toBeDefined();
    expect(screen.getByText('Add merge request dashboard')).toBeDefined();
    expect(screen.getByText('Merge request detail')).toBeDefined();
  });

  it('switches the merge requests tab to the shared review inbox for others', () => {
    render(
      <GitlabStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Merge requests' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Others' }));

    expect(screen.getByText('Review inbox gitlab others')).toBeDefined();
    expect(screen.getByText('Review merge request detail')).toBeDefined();
    expect(screen.queryByText('Merge request detail')).toBeNull();
  });

  it('renders the disconnected state and disables both data hooks', () => {
    h.isConnected = false;
    const workspaceId = 'workspace-1' as WorkspaceId;
    render(<GitlabStudio workspaceId={workspaceId} workspaceName="Goodboy" onClose={vi.fn()} />);

    expect(screen.getByText('Connect GitLab')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
    expect(h.useGitlabIssues).toHaveBeenCalledWith({ workspaceId, isEnabled: false });
    expect(h.useGitlabMrs).toHaveBeenCalledWith({ workspaceId, isEnabled: false });
  });
});
