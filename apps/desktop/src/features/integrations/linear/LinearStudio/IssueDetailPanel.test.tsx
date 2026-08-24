import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { LinearIssue } from '../client';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    session: { id: 'session-7', goal: '[GB-42] Improve linked issue detail' },
  })),
  loadSetting: vi.fn(async () => null),
  showToast: vi.fn(),
  ghPrHeadBranch: vi.fn(async (cwd: string) => `ak/from-${cwd.replace('/', '')}`),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
    projects: [] as ReadonlyArray<Record<string, unknown>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
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
vi.mock('../../../worktree/worktree', () => ({
  removeWorktree: vi.fn(),
  sessionDirExists: vi.fn(async () => false),
}));
vi.mock('../../../github/github', () => ({ ghPrHeadBranch: h.ghPrHeadBranch }));
vi.mock('../useLinearIssueComments', () => ({
  useLinearIssueComments: () => ({
    comments: [
      {
        id: 'comment-1',
        body: 'The fix is ready for review.',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        user: { name: 'Ada Lovelace' },
      },
    ],
    isLoading: false,
    error: null,
    post: vi.fn(async () => {}),
  }),
}));

import { IssueDetailPanel } from './IssueDetailPanel';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';

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

const ISSUE_WITH_PR: LinearIssue = {
  ...ISSUE,
  attachments: {
    nodes: [
      {
        id: 'attachment-1',
        title: 'PR #12',
        url: 'https://github.com/acme/web/pull/12',
        sourceType: 'github',
        metadata: { status: 'open' },
      },
    ],
  },
};

const REPO_PROJECTS = [
  { id: 'project-1', workspaceId: 'workspace-1', name: 'web', rootPath: '/repo', kind: 'repo' },
  { id: 'project-2', workspaceId: 'workspace-1', name: 'api', rootPath: '/api', kind: 'repo' },
];

const renderIssue = (issue: LinearIssue) =>
  render(
    <IssueDetailPanel
      issue={issue}
      sessionId={null}
      workspaceId={'workspace-1' as WorkspaceId}
      onClose={vi.fn()}
    />,
  );

beforeEach(() => {
  h.createSession.mockClear();
  h.loadSetting.mockClear();
  h.showToast.mockClear();
  h.ghPrHeadBranch.mockClear();
  h.store.projects = [];
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
    expect(screen.getByText(formatAbsoluteDateTime({ iso: ISSUE.updatedAt }))).toBeDefined();
  });

  it('keeps comments behind a badged conversation tab', async () => {
    render(
      <IssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: /Conversation/ })).toBeDefined());
    expect(screen.getByRole('tab', { name: 'Conversation 1' })).toBeDefined();
    expect(screen.queryByText('The fix is ready for review.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Conversation/ }));

    expect(screen.getByText('The fix is ready for review.')).toBeDefined();
  });

  it('offers no adopted branch until a project is picked on a multi-project workspace', async () => {
    h.store.projects = REPO_PROJECTS;

    renderIssue(ISSUE_WITH_PR);

    await waitFor(() => expect(screen.getByText('Which project?')).toBeDefined());
    expect(screen.getByText('Pick a project to configure the session')).toBeDefined();
    expect(screen.queryByRole('tab', { name: /Continue on PR #12/ })).toBeNull();
    expect(h.ghPrHeadBranch).not.toHaveBeenCalled();
  });

  it('resolves the adopted branch against the picked project and re-resolves on a switch', async () => {
    h.store.projects = REPO_PROJECTS;

    renderIssue(ISSUE_WITH_PR);

    await waitFor(() => expect(screen.getByRole('button', { name: /api/ })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /api/ }));

    await waitFor(() => expect(h.ghPrHeadBranch).toHaveBeenCalledWith('/api', 12, 'workspace-1'));
    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));
    await waitFor(() => expect(screen.getByText('ak/from-api')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /web/ }));

    await waitFor(() => expect(h.ghPrHeadBranch).toHaveBeenCalledWith('/repo', 12, 'workspace-1'));
    await waitFor(() => expect(screen.getByText('ak/from-repo')).toBeDefined());
    expect(screen.queryByText('ak/from-api')).toBeNull();
  });

  it('offers no adoption when the picked project is a folder', async () => {
    h.store.projects = [
      REPO_PROJECTS[0] as Record<string, unknown>,
      {
        id: 'project-3',
        workspaceId: 'workspace-1',
        name: 'notes',
        rootPath: '/notes',
        kind: 'folder',
      },
    ];

    renderIssue(ISSUE_WITH_PR);

    await waitFor(() => expect(screen.getByRole('button', { name: /notes/ })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /notes/ }));
    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));

    expect(screen.queryByRole('tab', { name: /Continue on PR #12/ })).toBeNull();
    expect(screen.getByLabelText('Folder name')).toBeDefined();
    expect(h.ghPrHeadBranch).not.toHaveBeenCalled();
  });
});
