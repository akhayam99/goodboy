import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';

const h = vi.hoisted(() => ({
  createSession: vi.fn(async () => ({ session: { goal: 'Fix launch' } })),
  showToast: vi.fn(),
  unlinkSessionExternalTask: vi.fn(async () => undefined),
  navigate: vi.fn(),
  requestIssueBrief: vi.fn(async (_params: unknown) => undefined),
  reportError: vi.fn(async () => undefined),
  linkSessionExternalTask: vi.fn(async () => undefined),
  patchSessionDraft: vi.fn(),
  startSessionFromDraft: vi.fn(async (_params: unknown) => ({ id: 'session-new', goal: 'Review' })),
  follow: vi.fn(),
}));

type StoreState = {
  readonly createSession: typeof h.createSession;
  readonly unlinkSessionExternalTask: typeof h.unlinkSessionExternalTask;
  readonly navigate: typeof h.navigate;
  readonly requestIssueBrief: typeof h.requestIssueBrief;
  readonly reportError: typeof h.reportError;
  readonly issueBriefs: Readonly<Record<string, never>>;
  readonly sessions: ReadonlyArray<never>;
  readonly linkSessionExternalTask: typeof h.linkSessionExternalTask;
  readonly patchSessionDraft: typeof h.patchSessionDraft;
  readonly startSessionFromDraft: typeof h.startSessionFromDraft;
  readonly projects: ReadonlyArray<never>;
  readonly projectSentryLinks: Readonly<Record<string, never>>;
  readonly workspaceIntegrations: Readonly<Record<string, never>>;
};

vi.mock('../../../../store', async () => {
  const state = (): StoreState =>
    ({
      projects: [],
      projectSentryLinks: {},
      workspaceIntegrations: {},
      createSession: h.createSession,
      unlinkSessionExternalTask: h.unlinkSessionExternalTask,
      navigate: h.navigate,
      requestIssueBrief: h.requestIssueBrief,
      reportError: h.reportError,
      issueBriefs: {},
      sessions: [],
      linkSessionExternalTask: h.linkSessionExternalTask,
      patchSessionDraft: h.patchSessionDraft,
      startSessionFromDraft: h.startSessionFromDraft,
    }) as StoreState;
  const useAppStore = <T,>(selector: (value: StoreState) => T) => selector(state());
  useAppStore.getState = state;
  useAppStore.subscribe = () => () => undefined;
  return {
    ...(await import('../../../../store/slices/navigation/place')),
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore,
  };
});

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../../shared/hooks/useFollowToast', () => ({
  useFollowToast: () => h.follow,
  useQuietFollowToast: () => h.follow,
}));

const { useRecordFrame } = await import('./index');
const { RecordHeader } = await import('../../../../shared/components/StudioDetail/RecordHeader');

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

type HarnessProps = {
  readonly record: InboxRecord;
  readonly launchRequest?: number;
  readonly onLaunched?: () => void;
  readonly onClose?: () => void;
};

const Harness = ({
  record,
  launchRequest = 0,
  onLaunched = vi.fn(),
  onClose = vi.fn(),
}: HarnessProps) => {
  const frame = useRecordFrame({
    record,
    workspaceId: WORKSPACE_ID,
    launchRequest,
    onLaunched,
    onRefresh: vi.fn(),
    onClose,
  });
  return (
    <RecordHeader
      provider={record.provider}
      identifier={record.identifier}
      title={record.title}
      frame={frame}
    />
  );
};

const GITHUB_RECORD = {
  key: 'github:issue:42',
  provider: 'github',
  kind: 'issue',
  identifier: '#42',
  title: 'Fix launch',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: 'https://github.com/acme/repo/issues/42',
  stateLabel: 'Open',
  context: 'GitHub',
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

const githubPullRequest = (role: 'author' | 'review-requested') =>
  ({
    key: `github:pr:318:${role}`,
    provider: 'github',
    kind: 'pr',
    identifier: '#318',
    title: 'Stop retried webhooks posting a second credit',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: 'https://github.com/acme/payments-api/pull/318',
    stateLabel: 'Open',
    context: 'GitHub',
    payload: {
      provider: 'github',
      kind: 'pr',
      role,
      sessionId: null,
      pr: {
        number: 318,
        title: 'Stop retried webhooks posting a second credit',
        url: 'https://github.com/acme/payments-api/pull/318',
        state: 'open',
        mergeable: true,
        checks: 'success',
        baseBranch: 'main',
        headBranch: 'nadia-p/single-credit',
        isDraft: false,
        reviewDecision: null,
        body: 'One credit per processor event.',
        updatedAt: '2026-08-01T10:00:00Z',
      },
    },
  }) satisfies InboxRecord;

const BITBUCKET_WITHOUT_REPO = {
  key: 'bitbucket:pr:42',
  provider: 'bitbucket',
  kind: 'pr',
  identifier: '#42',
  title: 'Fix launch',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  stateLabel: 'Open',
  context: 'Bitbucket',
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
  stateLabel: 'Open',
  context: 'Sentry',
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
  h.navigate.mockClear();
  h.patchSessionDraft.mockClear();
  h.requestIssueBrief.mockClear();
  h.startSessionFromDraft.mockClear();
  h.follow.mockClear();
  h.reportError.mockClear();
});

describe('useRecordFrame', () => {
  it('starts an issue in the New session draft: picked, its brief requested, one verb', () => {
    const onLaunched = vi.fn();
    const onNewSession = vi.fn();
    window.addEventListener('goodboy:new-session', onNewSession);
    render(<Harness record={GITHUB_RECORD} onLaunched={onLaunched} />);

    const primary = screen.getByRole('button', { name: /Start from #42/ });
    const actions = primary.closest('[data-slot="record-actions"]');
    expect(actions?.firstElementChild?.contains(primary)).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Start a session' })).toBeNull();

    fireEvent.click(primary);

    expect(h.patchSessionDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      patch: {
        choice: 'task',
        issueKey: 'github:42',
        pickedIssue: expect.objectContaining({ identifier: '#42', externalId: '42' }),
      },
    });
    expect(h.requestIssueBrief).toHaveBeenCalledWith({
      sources: [
        expect.objectContaining({
          provider: 'github',
          externalId: '42',
          body: 'Keep one dock.',
          noun: 'issue',
        }),
      ],
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    expect(onNewSession).toHaveBeenCalledOnce();
    expect(onLaunched).toHaveBeenCalledOnce();
    expect(h.createSession).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:new-session', onNewSession);
  });

  it('starts the issue from the list too: a launch request picks it without a popover', () => {
    const { rerender } = render(<Harness record={GITHUB_RECORD} />);
    expect(h.patchSessionDraft).not.toHaveBeenCalled();

    rerender(<Harness record={GITHUB_RECORD} launchRequest={1} />);

    expect(h.patchSessionDraft).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox', { name: 'Session goal' })).toBeNull();
  });

  it('keeps the one-step panel for a pull request that is yours, with the same verb', async () => {
    render(<Harness record={githubPullRequest('author')} />);

    const primary = screen.getByRole('button', { name: /Start from #318/ });
    fireEvent.click(primary);

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Session goal' }).value).toBe(
      'GitHub pull request #318: Stop retried webhooks posting a second credit\n\nOne credit per processor event.',
    );
    const [, launch] = screen.getAllByRole('button', { name: /Start from #318/ });
    fireEvent.click(launch as HTMLElement);

    await waitFor(() =>
      expect(h.createSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        goal: 'GitHub pull request #318: Stop retried webhooks posting a second credit\n\nOne credit per processor event.',
        externalTasks: [
          {
            provider: 'github',
            externalId: '318',
            identifier: '#318',
            url: 'https://github.com/acme/payments-api/pull/318',
            title: 'Stop retried webhooks posting a second credit',
          },
        ],
      }),
    );
  });

  it('opens the panel on a launch request from the list for a pull request that is yours', () => {
    const { rerender } = render(<Harness record={githubPullRequest('author')} />);
    expect(screen.queryByRole('textbox', { name: 'Session goal' })).toBeNull();

    rerender(<Harness record={githubPullRequest('author')} launchRequest={1} />);

    expect(screen.getByRole('textbox', { name: 'Session goal' })).toBeDefined();
  });

  it('offers Review pull request, not Start, for a pull request waiting on you', async () => {
    const onLaunched = vi.fn();
    render(<Harness record={githubPullRequest('review-requested')} onLaunched={onLaunched} />);

    expect(screen.queryByRole('button', { name: /Start from #318/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Review pull request/ }));

    await waitFor(() => expect(h.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(h.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: expect.objectContaining({
        kind: 'task',
        candidate: expect.objectContaining({ identifier: '#318', externalId: '318' }),
        title: 'Review #318: Stop retried webhooks posting a second credit',
        then: { kind: 'agent', agentKind: 'pr-reviewer', prompt: '', routing: null },
        checkout: { existingBranch: 'nadia-p/single-credit', fallbackRef: 'pull/318/head' },
      }),
    });
    await waitFor(() => expect(onLaunched).toHaveBeenCalledOnce());
    expect(h.follow).toHaveBeenCalledOnce();
    expect(h.follow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Review started', startKey: 'session-new' }),
    );
    expect(h.navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({
        at: 'session',
        sessionId: 'session-new',
        view: expect.objectContaining({
          lens: 'branch',
          target: expect.objectContaining({ kind: 'branch', tab: 'pr' }),
        }),
      }),
    });
  });

  it('reports a failed review start and raises no success toast', async () => {
    h.startSessionFromDraft.mockRejectedValueOnce(new Error('worktree failed'));
    const onLaunched = vi.fn();
    render(<Harness record={githubPullRequest('review-requested')} onLaunched={onLaunched} />);

    fireEvent.click(screen.getByRole('button', { name: /Review pull request/ }));

    await waitFor(() => expect(h.reportError).toHaveBeenCalledOnce());
    expect(h.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't start the review" }),
    );
    expect(h.follow).not.toHaveBeenCalled();
    expect(onLaunched).not.toHaveBeenCalled();
  });

  it('makes Open session the primary once a session is linked, and opens it on request', async () => {
    const onLaunched = vi.fn();
    const { rerender } = render(<Harness record={LINKED_SENTRY_RECORD} onLaunched={onLaunched} />);

    expect(screen.getByRole('button', { name: 'Open session' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Start from/ })).toBeNull();

    rerender(<Harness record={LINKED_SENTRY_RECORD} onLaunched={onLaunched} launchRequest={1} />);

    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SENTRY_SESSION_ID }),
      }),
    );
    await waitFor(() => expect(onLaunched).toHaveBeenCalledOnce());
  });

  it('keeps Remove link to session in the overflow menu of a linked sentry issue', async () => {
    render(<Harness record={LINKED_SENTRY_RECORD} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for GBY-5' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove link to session' }));

    await waitFor(() =>
      expect(h.unlinkSessionExternalTask).toHaveBeenCalledWith(
        SENTRY_SESSION_ID,
        'sentry',
        '12345',
      ),
    );
  });

  it('leaves the primary slot empty when the record cannot resolve a launch target', () => {
    render(<Harness record={BITBUCKET_WITHOUT_REPO} />);

    expect(screen.queryByRole('button', { name: /Start from/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open session' })).toBeNull();
  });

  it('closes the record from the identity line', () => {
    const onClose = vi.fn();
    render(<Harness record={GITHUB_RECORD} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close the item' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
