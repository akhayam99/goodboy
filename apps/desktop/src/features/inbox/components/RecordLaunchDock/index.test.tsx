import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({ session: { goal: 'Fix launch' } })),
  showToast: vi.fn(),
  unlinkSessionExternalTask: vi.fn(async () => undefined),
  setCurrentSession: vi.fn(async () => undefined),
  setActiveLens: vi.fn(),
}));

type StoreState = {
  readonly createSession: typeof h.createSession;
  readonly unlinkSessionExternalTask: typeof h.unlinkSessionExternalTask;
  readonly setCurrentSession: typeof h.setCurrentSession;
  readonly setActiveLens: typeof h.setActiveLens;
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: StoreState) => T) =>
    selector({
      createSession: h.createSession,
      unlinkSessionExternalTask: h.unlinkSessionExternalTask,
      setCurrentSession: h.setCurrentSession,
      setActiveLens: h.setActiveLens,
    }),
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

const SENTRY_SESSION_ID = 'session-7' as SessionId;

const LINKED_SENTRY_RECORD = {
  key: 'sentry:error:12345',
  provider: 'sentry',
  kind: 'error',
  identifier: 'GBY-5',
  title: 'Request failed',
  state: 'alert',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  meta: 'Sentry',
  payload: {
    provider: 'sentry',
    kind: 'error',
    issue: {
      id: '12345',
      shortId: 'GBY-5',
      title: 'Request failed',
      culprit: null,
      level: null,
      status: 'unresolved',
      count: null,
      userCount: null,
      firstSeen: null,
      lastSeen: null,
      permalink: null,
      metadata: null,
    },
    sessionId: SENTRY_SESSION_ID,
  },
} satisfies InboxRecord;

afterEach(() => {
  cleanup();
  h.createSession.mockClear();
  h.unlinkSessionExternalTask.mockClear();
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

  it('keeps the linked notice and unlinks a sentry issue from its session', async () => {
    render(
      <RecordLaunchDock
        record={LINKED_SENTRY_RECORD}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Session already launched')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink from session' }));

    await waitFor(() =>
      expect(h.unlinkSessionExternalTask).toHaveBeenCalledWith(
        SENTRY_SESSION_ID,
        'sentry',
        '12345',
      ),
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
