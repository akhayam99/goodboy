import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({ session: { goal: 'Fix launch' } })),
  showToast: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { createSession: typeof h.createSession }) => T) =>
    selector({ createSession: h.createSession }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

const { RecordLaunchDock } = await import('./index');

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const GITHUB_RECORD = {
  key: 'github:issue:42',
  provider: 'github',
  kind: 'issue',
  identifier: '#42',
  title: 'Fix launch',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: 'https://github.com/acme/repo/issues/42',
  meta: 'GitHub',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 42,
      title: 'Fix launch',
      body: 'Keep one dock.',
      url: 'https://github.com/acme/repo/issues/42',
      state: 'OPEN',
      labels: [],
      updatedAt: '2026-08-01T10:00:00Z',
    },
    sessionId: null,
  },
} satisfies InboxRecord;

const BITBUCKET_WITHOUT_REPO = {
  key: 'bitbucket:pr:42',
  provider: 'bitbucket',
  kind: 'pr',
  identifier: '#42',
  title: 'Fix launch',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  meta: 'Bitbucket',
  payload: {
    provider: 'bitbucket',
    kind: 'pr',
    pullRequest: {
      id: 42,
      title: 'Fix launch',
      description: '',
      state: 'OPEN',
      createdOn: '',
      updatedOn: '',
      sourceBranch: 'feature',
      sourceCommit: null,
      destinationBranch: 'main',
      destinationCommit: null,
      author: null,
      reviewers: [],
      participants: [],
      closeSourceBranch: false,
      mergeCommit: null,
      commentCount: 0,
      taskCount: 0,
      webUrl: null,
    },
    repo: null,
  },
} satisfies InboxRecord;

afterEach(() => {
  cleanup();
  h.createSession.mockClear();
});

describe('RecordLaunchDock', () => {
  it('builds the provider goal and creates a session with the external task', async () => {
    render(
      <RecordLaunchDock record={GITHUB_RECORD} workspaceId={WORKSPACE_ID} onClose={vi.fn()} />,
    );

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Session goal' }).value).toBe(
      'GitHub issue #42: Fix launch\n\nKeep one dock.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Launch session' }));

    await waitFor(() =>
      expect(h.createSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        goal: 'GitHub issue #42: Fix launch\n\nKeep one dock.',
        externalTasks: [
          {
            provider: 'github',
            externalId: '42',
            identifier: '#42',
            url: 'https://github.com/acme/repo/issues/42',
            title: 'Fix launch',
          },
        ],
      }),
    );
  });

  it('stays hidden when the record cannot resolve a launch target', () => {
    const view = render(
      <RecordLaunchDock
        record={BITBUCKET_WITHOUT_REPO}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    expect(view.container.childElementCount).toBe(0);
  });
});
