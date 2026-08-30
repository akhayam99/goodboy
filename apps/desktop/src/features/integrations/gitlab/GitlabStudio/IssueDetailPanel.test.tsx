import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import {
  gitlabCreateIssueNote,
  gitlabListIssueNotes,
  gitlabUpdateIssueDescription,
  type GitlabIssue,
} from '../client';

type StoreGitlabIntegration = { provider: string; config: { host: string } };

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({
    session: { id: 'session-9', goal: 'GitLab issue acme/web#7: Fix pipeline flake' },
  })),
  loadSetting: vi.fn(async () => null),
  showToast: vi.fn(),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
    workspaceIntegrations: {
      'workspace-1': [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
    } as Record<string, ReadonlyArray<StoreGitlabIntegration>>,
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
vi.mock('../../../worktree/worktree', () => ({ removeWorktree: vi.fn() }));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  gitlabUpdateIssueDescription: vi.fn(),
  gitlabListIssueNotes: vi.fn(async () => []),
  gitlabCreateIssueNote: vi.fn(async () => 1),
}));

import { IssueDetailPanel } from './IssueDetailPanel';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';

const updateDescription = vi.mocked(gitlabUpdateIssueDescription);
const listIssueNotes = vi.mocked(gitlabListIssueNotes);
const createIssueNote = vi.mocked(gitlabCreateIssueNote);

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
  updateDescription.mockReset();
  listIssueNotes.mockReset();
  listIssueNotes.mockResolvedValue([]);
  createIssueNote.mockReset();
  createIssueNote.mockResolvedValue(1);
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

  it('saves an edited description through the GitLab client', async () => {
    updateDescription.mockResolvedValueOnce('Body normalized by GitLab');
    render(
      <IssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'Body typed by the user' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateDescription).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        host: 'https://gitlab.com',
        projectPath: 'acme/web',
        issueIid: 7,
        description: 'Body typed by the user',
      }),
    );
    await waitFor(() => expect(screen.getByText('Body normalized by GitLab')).toBeDefined());
  });

  it('renders the conversation notes without the system notes and posts a new one', async () => {
    listIssueNotes.mockResolvedValue([
      {
        id: 1,
        body: 'Reproduced on staging',
        system: false,
        author: { username: 'alice', name: 'Alice', avatarUrl: null },
        createdAt: '2026-07-22T10:00:00Z',
      },
      {
        id: 2,
        body: 'changed the weight to 3',
        system: true,
        author: null,
        createdAt: '2026-07-22T10:01:00Z',
      },
    ]);
    render(
      <IssueDetailPanel
        issue={ISSUE}
        sessionId={null}
        workspaceId={'workspace-1' as WorkspaceId}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));

    await waitFor(() => expect(screen.getByText('Reproduced on staging')).toBeDefined());
    expect(screen.queryByText('changed the weight to 3')).toBeNull();
    expect(screen.getByText('1 system event hidden')).toBeDefined();

    fireEvent.change(screen.getByRole('textbox', { name: 'Write a note' }), {
      target: { value: 'Confirmed the fix' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() =>
      expect(createIssueNote).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        host: 'https://gitlab.com',
        projectPath: 'acme/web',
        issueIid: 7,
        body: 'Confirmed the fix',
      }),
    );
  });
});
