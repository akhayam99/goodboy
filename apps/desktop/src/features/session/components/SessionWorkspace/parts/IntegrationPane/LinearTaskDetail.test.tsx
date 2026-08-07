import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { useLinearIssue } from '../../../../../integrations/linear/useLinearIssue';
import { LinearTaskDetail } from './LinearTaskDetail';

vi.mock('../../../../../integrations/linear/useLinearIssue', () => ({
  useLinearIssue: vi.fn(),
}));

const useLinearIssueMock = vi.mocked(useLinearIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const TASK: SessionExternalTask = {
  sessionId: 'session-1' as SessionId,
  provider: 'linear',
  externalId: 'ISSUE-7',
  identifier: 'ACME-7',
  title: 'Fix the thing',
  url: 'https://linear.app/acme/issue/ACME-7',
  createdAt: '2026-07-22T12:00:00.000Z' as IsoDateTime,
};

afterEach(cleanup);

describe('LinearTaskDetail', () => {
  it('shows an error with a retry action that calls refetch', () => {
    const refetch = vi.fn();
    useLinearIssueMock.mockReturnValue({
      issue: null,
      isLoading: false,
      error: 'request failed',
      refetch,
    });

    render(<LinearTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
