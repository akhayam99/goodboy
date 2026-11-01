// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  PrComment,
  ProjectId,
  PullRequestState,
  PullRequestView,
  ResolveThread,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';
import { useThreadVisit } from '../../../resolve/hooks/useThreadVisit';
import { queueRowAt } from '../../../resolve/testing/queueRow';
import { withPullRequestViewEntry } from '../../../../store/slices/pull-request-view/pullRequestViewAt';
import { usePullRequestReadiness } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const PROJECT_LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const PROJECT_PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });
const MOUNT_LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const MOUNT_PAYMENTS = brandId<MountId>({ value: 'mount-payments-api' });
const STAMP = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });
const SAME_NUMBER = 12;

const mountOf = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly parallelIndex: number;
}): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: `hl/${name}`,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const prOf = ({ name }: { readonly name: string }): PullRequestState => ({
  number: SAME_NUMBER,
  title: `Tidy ${name}`,
  url: `https://github.com/harborline/${name}/pull/${SAME_NUMBER}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: `hl/${name}`,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
});

const githubOf = ({
  mount,
  name,
}: {
  readonly mount: SessionProjectMount;
  readonly name: string;
}): MountGithubState => {
  const pr = prOf({ name });
  return {
    mountId: mount.mountId,
    projectId: mount.projectId,
    revision: 1,
    repository: `harborline/${name}`,
    host: 'github.com',
    branch: mount.branch,
    prs: [pr],
    links: [],
    pr,
    linkedIssues: [],
    fetchedAt: STAMP,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

const viewOf = ({
  name,
  mergeMethods,
}: {
  readonly name: string;
  readonly mergeMethods: PullRequestView['mergeMethods'];
}): PullRequestView => ({
  host: 'github',
  number: SAME_NUMBER,
  title: `Tidy ${name}`,
  body: '',
  url: `https://github.com/harborline/${name}/pull/${SAME_NUMBER}`,
  state: 'open',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: `hl/${name}`,
  headSha: null,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-06T10:00:00Z',
  mergedAt: null,
  mergeable: true,
  reviewDecision: null,
  reviewers: [],
  resolves: [],
  checks: { read: 'ok', error: null, runs: [] },
  files: { count: 0, first: [] },
  commits: [],
  mergeMethods,
  mergeMethodReasons: {},
});

const entryOf = ({
  mountId,
  view,
}: {
  readonly mountId: MountId;
  readonly view: PullRequestView;
}) =>
  withPullRequestViewEntry({
    views: {},
    sessionId: SESSION_ID,
    entry: {
      prNumber: SAME_NUMBER,
      mountId,
      view,
      isLoading: false,
      error: null,
      fetchedAt: STAMP,
      edits: [],
    },
  })[SESSION_ID] ?? {};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const LEDGER = mountOf({
  mountId: MOUNT_LEDGER,
  projectId: PROJECT_LEDGER,
  name: 'ledger-core',
  parallelIndex: 0,
});
const PAYMENTS = mountOf({
  mountId: MOUNT_PAYMENTS,
  projectId: PROJECT_PAYMENTS,
  name: 'payments-api',
  parallelIndex: 1,
});

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    sessions: [
      aSession({
        id: SESSION_ID,
        workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      }),
    ],
    projects: [
      aProject({ id: PROJECT_LEDGER, name: 'ledger-core' }),
      aProject({ id: PROJECT_PAYMENTS, name: 'payments-api' }),
    ],
    sessionProjectMounts: { [SESSION_ID]: [LEDGER, PAYMENTS] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_LEDGER },
    mountGithub: {
      [MOUNT_LEDGER]: githubOf({ mount: LEDGER, name: 'ledger-core' }),
      [MOUNT_PAYMENTS]: githubOf({ mount: PAYMENTS, name: 'payments-api' }),
    },
    pullRequestViews: {
      [SESSION_ID]: {
        ...entryOf({
          mountId: MOUNT_LEDGER,
          view: viewOf({ name: 'ledger-core', mergeMethods: ['merge'] }),
        }),
        ...entryOf({
          mountId: MOUNT_PAYMENTS,
          view: viewOf({ name: 'payments-api', mergeMethods: ['squash'] }),
        }),
      },
    },
  });
});

afterEach(cleanup);

const readinessOf = ({ mountId }: { readonly mountId: MountId }) =>
  renderHook(() =>
    usePullRequestReadiness({ sessionId: SESSION_ID, mountId, isRebaseStopOpen: false }),
  );

describe('usePullRequestReadiness with the same request number in two repositories', () => {
  it('reads the merge methods of the mount on screen, not of the one chat writes to', () => {
    expect(readinessOf({ mountId: MOUNT_PAYMENTS }).result.current.facts.mergeMethods).toEqual([
      'squash',
    ]);
    expect(readinessOf({ mountId: MOUNT_LEDGER }).result.current.facts.mergeMethods).toEqual([
      'merge',
    ]);
  });

  it('never borrows the view of the other mount while its own has not arrived', () => {
    useAppStore.setState({
      pullRequestViews: {
        [SESSION_ID]: entryOf({
          mountId: MOUNT_LEDGER,
          view: viewOf({ name: 'ledger-core', mergeMethods: ['merge'] }),
        }),
      },
    });

    const merge = readinessOf({ mountId: MOUNT_PAYMENTS }).result.current.facts.mergeMethods;

    expect(merge).not.toEqual(['merge']);
  });
});

const reviewCommentOf = ({
  id,
  threadId,
  author,
}: {
  readonly id: string;
  readonly threadId: string;
  readonly author: string;
}): PrComment => ({
  id,
  threadId,
  author,
  authorAvatarUrl: null,
  body: 'Please rename this in ledger-core',
  createdAt: '2026-10-06T09:00:00Z',
  url: `https://github.com/harborline/ledger-core/pull/${SAME_NUMBER}#${id}`,
  source: 'review',
});

const threadOf = ({
  threadId,
  prNumber = SAME_NUMBER,
}: {
  readonly threadId: string;
  readonly prNumber?: number;
}): ResolveThread => ({
  ...queueRowAt({ stage: 'new', threadId }).thread,
  sessionId: SESSION_ID,
  projectId: PROJECT_LEDGER,
  prNumber,
});

const seedUnread = ({ isViewerKnown }: { readonly isViewerKnown: boolean }): void => {
  const github = githubOf({ mount: LEDGER, name: 'ledger-core' });
  useAppStore.setState({
    mountGithub: {
      [MOUNT_LEDGER]: {
        ...github,
        detail: {
          prNumber: SAME_NUMBER,
          comments: [
            reviewCommentOf({ id: 'c1', threadId: 'thread-a', author: 'northwind-rev' }),
            reviewCommentOf({ id: 'c2', threadId: 'thread-b', author: 'northwind-rev' }),
            reviewCommentOf({ id: 'c3', threadId: 'thread-c', author: 'harborline-dev' }),
            reviewCommentOf({ id: 'c4', threadId: 'thread-other', author: 'northwind-rev' }),
          ],
          reviews: [],
          reviewRequests: [],
          checks: [],
        },
        detailFetchedAt: STAMP,
      },
    },
    sessionResolveThreads: {
      [SESSION_ID]: [
        threadOf({ threadId: 'thread-a' }),
        threadOf({ threadId: 'thread-b' }),
        threadOf({ threadId: 'thread-c' }),
        threadOf({ threadId: 'thread-other', prNumber: 99 }),
      ],
    },
    githubStatus: isViewerKnown
      ? { mode: 'gh-cli', available: true, user: 'harborline-dev' }
      : null,
  });
};

const commitStub = { status: 'committed', results: [] };

const detailWith = ({
  comments,
}: {
  readonly comments: ReadonlyArray<PrComment>;
}): MountGithubState => ({
  ...githubOf({ mount: LEDGER, name: 'ledger-core' }),
  detail: { prNumber: SAME_NUMBER, comments, reviews: [], reviewRequests: [], checks: [] },
  detailFetchedAt: STAMP,
});

describe('useThreadVisit', () => {
  it('sends the marks again on the next list change after a failed write, then keeps them', async () => {
    seedUnread({ isViewerKnown: true });
    const attempts: Array<unknown> = [];
    stubStoryInvoke({
      db_select: [],
      db_execute: { rowsAffected: 0 },
      db_transaction: (args: unknown) => {
        attempts.push(args);
        if (attempts.length === 1) {
          throw new Error('disk is full');
        }
        return commitStub;
      },
    });

    const { result } = renderHook(() =>
      useThreadVisit({ sessionId: SESSION_ID, mountId: MOUNT_LEDGER }),
    );
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(useAppStore.getState().sessionThreadReads[SESSION_ID]).toEqual({});

    act(() => {
      useAppStore.setState((state) => ({
        sessionResolveThreads: {
          [SESSION_ID]: [
            ...(state.sessionResolveThreads[SESSION_ID] ?? []),
            threadOf({ threadId: 'thread-d' }),
          ],
        },
      }));
    });

    await waitFor(() => expect(attempts).toHaveLength(2));
    await waitFor(() =>
      expect(Object.keys(useAppStore.getState().sessionThreadReads[SESSION_ID] ?? {})).toEqual(
        expect.arrayContaining(['thread-a', 'thread-b']),
      ),
    );
    expect([...result.current].sort()).toEqual(['thread-a', 'thread-b', 'thread-d']);
  });

  it('shows and records a reply that arrives while the tab is open', async () => {
    seedUnread({ isViewerKnown: true });
    stubStoryInvoke({ db_select: [], db_transaction: commitStub });
    const { result } = renderHook(() =>
      useThreadVisit({ sessionId: SESSION_ID, mountId: MOUNT_LEDGER }),
    );
    await waitFor(() =>
      expect(useAppStore.getState().sessionThreadReads[SESSION_ID]?.['thread-a']).toBe(
        Date.parse('2026-10-06T09:00:00Z'),
      ),
    );

    act(() => {
      const github = useAppStore.getState().mountGithub[MOUNT_LEDGER];
      const reply = {
        ...reviewCommentOf({ id: 'c5', threadId: 'thread-c', author: 'northwind-rev' }),
        createdAt: '2026-10-06T11:00:00Z',
      };
      useAppStore.setState({
        mountGithub: {
          [MOUNT_LEDGER]: detailWith({
            comments: [...(github?.detail?.comments ?? []), reply],
          }),
        },
      });
    });

    await waitFor(() =>
      expect(useAppStore.getState().sessionThreadReads[SESSION_ID]?.['thread-c']).toBe(
        Date.parse('2026-10-06T11:00:00Z'),
      ),
    );
    expect(result.current.has('thread-c')).toBe(true);
  });
});

describe('usePullRequestReadiness unread threads', () => {
  it('counts the threads of this pull request that someone else wrote and you have not read', async () => {
    seedUnread({ isViewerKnown: true });

    const { result } = readinessOf({ mountId: MOUNT_LEDGER });

    await waitFor(() => expect(result.current.commentsUnread).toBe(2));
  });

  it('counts nothing before the reads of the session have loaded', async () => {
    seedUnread({ isViewerKnown: true });
    stubStoryInvoke({ db_select: () => new Promise(() => undefined) });

    const { result } = readinessOf({ mountId: MOUNT_LEDGER });
    await act(async () => undefined);

    expect(result.current.commentsUnread).toBe(0);
  });

  it('counts nothing while the identity of the host is not known', async () => {
    seedUnread({ isViewerKnown: false });

    const { result } = readinessOf({ mountId: MOUNT_LEDGER });
    await act(async () => undefined);

    expect(result.current.commentsUnread).toBe(0);
  });

  it('counts the threads once the identity arrives', async () => {
    seedUnread({ isViewerKnown: false });
    const { result } = readinessOf({ mountId: MOUNT_LEDGER });
    await act(async () => undefined);

    act(() => {
      useAppStore.setState({
        githubStatus: { mode: 'gh-cli', available: true, user: 'harborline-dev' },
      });
    });

    await waitFor(() => expect(result.current.commentsUnread).toBe(2));
  });
});
