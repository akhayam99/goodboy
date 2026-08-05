import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { linearUpdateIssueDescription, type LinearIssue } from './client';
import { useLinearIssueDescription } from './useLinearIssueDescription';

vi.mock('./client', () => ({ linearUpdateIssueDescription: vi.fn() }));

const updateDescription = vi.mocked(linearUpdateIssueDescription);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const ISSUE: LinearIssue = {
  id: 'issue-1',
  identifier: 'GB-42',
  title: 'Improve linked issue detail',
  description: 'Original body',
  url: 'https://linear.app/goodboy/issue/GB-42',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'GB' },
  updatedAt: '2026-07-23T10:00:00Z',
};

beforeEach(() => {
  updateDescription.mockReset();
});

afterEach(cleanup);

describe('useLinearIssueDescription', () => {
  it('sends the typed body to Linear and then shows the body Linear returned', async () => {
    updateDescription.mockResolvedValueOnce('Body normalized by Linear');
    const { result } = renderHook(() =>
      useLinearIssueDescription({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );

    await result.current.save?.('Body typed by the user');

    expect(updateDescription).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-1',
      description: 'Body typed by the user',
    });
    await waitFor(() => expect(result.current.description).toBe('Body normalized by Linear'));
  });

  it('leaves the surface read-only when there is no workspace to write to', () => {
    const { result } = renderHook(() =>
      useLinearIssueDescription({ issue: ISSUE, workspaceId: null }),
    );

    expect(result.current.save).toBeNull();

    render(<DescriptionSection text={result.current.description} onSave={result.current.save} />);

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});
