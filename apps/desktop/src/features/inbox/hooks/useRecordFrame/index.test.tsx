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
  requestIssueBrief: vi.fn(async (_params: unknown) => undefined),
  reportError: vi.fn(async () => undefined),
}));

type StoreState = {
  readonly createSession: typeof h.createSession;
  readonly unlinkSessionExternalTask: typeof h.unlinkSessionExternalTask;
  readonly setCurrentSession: typeof h.setCurrentSession;
  readonly setActiveLens: typeof h.setActiveLens;
  readonly requestIssueBrief: typeof h.requestIssueBrief;
  readonly reportError: typeof h.reportError;
  readonly issueBriefs: Readonly<Record<string, never>>;
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: StoreState) => T) =>
    selector({
      createSession: h.createSession,
      unlinkSessionExternalTask: h.unlinkSessionExternalTask,
      setCurrentSession: h.setCurrentSession,
      setActiveLens: h.setActiveLens,
      requestIssueBrief: h.requestIssueBrief,
      reportError: h.reportError,
      issueBriefs: {},
    }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
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
  h.setCurrentSession.mockClear();
});

describe('useRecordFrame', () => {
  it('puts Launch session first and launches from its popover with the provider goal', async () => {
    render(<Harness record={GITHUB_RECORD} />);

    const primary = screen.getByRole('button', { name: /Launch session/ });
    const actions = primary.closest('[data-slot="record-actions"]');
    expect(actions?.firstElementChild?.contains(primary)).toBe(true);

    fireEvent.click(primary);

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Session goal' }).value).toBe(
      'GitHub issue #42: Fix launch\n\nKeep one dock.',
    );
    expect(h.requestIssueBrief).toHaveBeenCalledWith({
      source: expect.objectContaining({
        provider: 'github',
        externalId: '42',
        body: 'Keep one dock.',
        noun: 'issue',
      }),
      workspaceId: WORKSPACE_ID,
      sessionId: null,
    });
    const [, launch] = screen.getAllByRole('button', { name: /Launch session/ });
    fireEvent.click(launch as HTMLElement);

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

  it('opens the launch popover on a launch request from the list', () => {
    const { rerender } = render(<Harness record={GITHUB_RECORD} />);
    expect(screen.queryByRole('textbox', { name: 'Session goal' })).toBeNull();

    rerender(<Harness record={GITHUB_RECORD} launchRequest={1} />);

    expect(screen.getByRole('textbox', { name: 'Session goal' })).toBeDefined();
  });

  it('makes Open session the primary once a session is linked, and opens it on request', async () => {
    const onLaunched = vi.fn();
    const { rerender } = render(<Harness record={LINKED_SENTRY_RECORD} onLaunched={onLaunched} />);

    expect(screen.getByRole('button', { name: 'Open session' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Launch session/ })).toBeNull();

    rerender(<Harness record={LINKED_SENTRY_RECORD} onLaunched={onLaunched} launchRequest={1} />);

    await waitFor(() => expect(h.setCurrentSession).toHaveBeenCalledWith(SENTRY_SESSION_ID));
    await waitFor(() => expect(onLaunched).toHaveBeenCalledOnce());
  });

  it('keeps Unlink session in the overflow menu of a linked sentry issue', async () => {
    render(<Harness record={LINKED_SENTRY_RECORD} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for GBY-5' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unlink session' }));

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

    expect(screen.queryByRole('button', { name: /Launch session/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open session' })).toBeNull();
  });

  it('closes the record from the identity line', () => {
    const onClose = vi.fn();
    render(<Harness record={GITHUB_RECORD} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close the item' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
