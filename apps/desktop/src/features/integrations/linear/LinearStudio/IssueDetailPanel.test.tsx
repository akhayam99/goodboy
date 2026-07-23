import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { LinearIssue } from '../client';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    session: { id: 'session-7', goal: '[GB-42] Improve linked issue detail' },
  })),
  loadSetting: vi.fn(async () => null),
  showToast: vi.fn(),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (
      state: typeof h.store & {
        createSession: typeof h.createSession;
        loadSetting: typeof h.loadSetting;
      },
    ) => T,
  ) => selector({ ...h.store, createSession: h.createSession, loadSetting: h.loadSetting }),
}));
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));
vi.mock('../../../worktree/useBranchConflict', () => ({ useBranchConflict: () => null }));
vi.mock('../../../worktree/worktree', () => ({ removeWorktree: vi.fn() }));
vi.mock('../useLinearIssueComments', () => ({
  useLinearIssueComments: () => ({ comments: [], isLoading: false, error: null }),
}));

import { IssueDetailPanel } from './IssueDetailPanel';

const ISSUE: LinearIssue = {
  id: 'issue-1',
  identifier: 'GB-42',
  title: 'Improve linked issue detail',
  description: '**Full** description',
  url: 'https://linear.app/goodboy/issue/GB-42',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'GB' },
  priority: 1,
  priorityLabel: 'Urgent',
  assignee: { name: 'Grace Hopper' },
  project: { name: 'Desktop' },
  labels: { nodes: [{ name: 'UI', color: '#5e6ad2' }] },
  updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
};

beforeEach(() => {
  h.createSession.mockClear();
  h.loadSetting.mockClear();
  h.showToast.mockClear();
});

afterEach(cleanup);

describe('IssueDetailPanel', () => {
  it('surfaces assignee, project, and last update in the metadata rail', async () => {
    render(
      <IssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Session goal' })).toBeDefined(),
    );
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(screen.getByText('Desktop')).toBeDefined();
    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText('2h ago')).toBeDefined();
  });
});
