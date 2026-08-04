import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import type { GitlabIssue } from '../../../../../integrations/gitlab/client';
import { useGitlabIssue } from '../../../../../integrations/gitlab/useGitlabIssue';
import { GitlabTaskDetail } from './GitlabTaskDetail';

vi.mock('../../../../../integrations/gitlab/useGitlabIssue', () => ({
  useGitlabIssue: vi.fn(),
}));

const useGitlabIssueMock = vi.mocked(useGitlabIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const TASK: SessionExternalTask = {
  sessionId: 'session-1' as SessionId,
  provider: 'gitlab',
  externalId: '101',
  identifier: 'acme/web#7',
  title: 'Fix the thing',
  url: 'https://gitlab.com/acme/web/-/issues/7',
  createdAt: '2026-07-22T12:00:00.000Z' as IsoDateTime,
};

const ISSUE: GitlabIssue = {
  id: 101,
  iid: 7,
  projectId: 3,
  title: 'Fix the thing',
  description: 'Investigate the flaky request.',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/7',
  references: { full: 'acme/web#7' },
  updatedAt: '2026-05-21T10:00:00Z',
  milestone: null,
  labels: ['bug'],
};

afterEach(cleanup);

describe('GitlabTaskDetail', () => {
  it('shows a loading skeleton while the issue is being fetched', () => {
    useGitlabIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<GitlabTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByRole('status', { name: 'Loading GitLab issue' })).toBeDefined();
  });

  it('shows an error with a retry action that calls refetch', () => {
    const refetch = vi.fn();
    useGitlabIssueMock.mockReturnValue({
      issue: null,
      isLoading: false,
      error: 'request failed',
      refetch,
    });

    render(<GitlabTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders the loaded issue title, description and properties', () => {
    useGitlabIssueMock.mockReturnValue({
      issue: ISSUE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GitlabTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByText('Fix the thing')).toBeDefined();
    expect(screen.getByText('Investigate the flaky request.')).toBeDefined();
    expect(screen.getByText('bug')).toBeDefined();
  });
});
