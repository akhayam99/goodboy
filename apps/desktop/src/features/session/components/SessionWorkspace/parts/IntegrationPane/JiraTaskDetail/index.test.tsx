import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type SessionExternalTask,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { useJiraIssue } from '../../../../../../integrations/jira/useJiraIssue';
import { JiraTaskDetail } from '.';

vi.mock('../../../../../../integrations/jira/useJiraIssue', () => ({
  useJiraIssue: vi.fn(),
}));

const useJiraIssueMock = vi.mocked(useJiraIssue);
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-1' });

const TASK: SessionExternalTask = {
  sessionId: brandId<SessionId>({ value: 'session-1' }),
  provider: 'jira',
  externalId: '10001',
  identifier: 'LEDGER-12',
  title: 'Fix the thing',
  url: 'https://northwind.atlassian.net/browse/LEDGER-12',
  createdAt: brandId<IsoDateTime>({ value: '2026-07-22T12:00:00.000Z' }),
};

afterEach(cleanup);

describe('JiraTaskDetail', () => {
  it('shows a loading skeleton under the task title while the issue is being fetched', () => {
    useJiraIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<JiraTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    screen.getByRole('status', { name: 'Loading Jira issue' });
    screen.getByText('Fix the thing');
    screen.getByText('LEDGER-12');
  });

  it('shows an error with a retry action that calls refetch', () => {
    const refetch = vi.fn();
    useJiraIssueMock.mockReturnValue({
      issue: null,
      isLoading: false,
      error: 'request failed',
      refetch,
    });

    render(<JiraTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    screen.getByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
