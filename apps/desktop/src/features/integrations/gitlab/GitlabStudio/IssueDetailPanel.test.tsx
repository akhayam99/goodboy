import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { GitlabIssue } from '../client';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    session: { id: 'session-9', goal: 'GitLab issue acme/web#7: Fix pipeline flake' },
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

import { IssueDetailPanel } from './IssueDetailPanel';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';

const ISSUE: GitlabIssue = {
  id: 71,
  iid: 7,
  projectId: 3,
  title: 'Fix pipeline flake',
  description: 'The nightly pipeline fails intermittently.',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/7',
  references: { full: 'acme/web#7' },
  updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
  milestone: { title: 'v1.3' },
  labels: ['bug'],
};

beforeEach(() => {
  h.createSession.mockClear();
  h.loadSetting.mockClear();
  h.showToast.mockClear();
});

afterEach(cleanup);

describe('IssueDetailPanel', () => {
  it('surfaces milestone, labels, and last update in the metadata rail', async () => {
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
    expect(screen.getByText('v1.3')).toBeDefined();
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText(formatAbsoluteDateTime({ iso: ISSUE.updatedAt }))).toBeDefined();
  });
});
