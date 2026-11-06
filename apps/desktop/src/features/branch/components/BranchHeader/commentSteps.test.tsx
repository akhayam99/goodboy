// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type MountId,
  type ProjectId,
  type PullRequestState,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import type { BranchReviewCounts } from '../../branchPrimary';
import { NO_COMMENT_FACTS, type BranchStepComments } from '../../branchStepOf';
import { useBranchControls } from '../../hooks/useBranchControls';
import { BranchHeader } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-export' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-payments-api' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments-api' });

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/w/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch: 'feat/export',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const PR: PullRequestState = {
  number: 318,
  title: 'Ledger export',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feat/export',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

const MOUNT_GITHUB: MountGithubState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: null,
  host: null,
  branch: MOUNT.branch,
  prs: [PR],
  links: [],
  pr: PR,
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const NO_REVIEW: BranchReviewCounts = {
  accepted: 0,
  replies: 0,
  failed: 0,
  isPushing: false,
  push: { state: 'idle', count: 0 },
};

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation(async (command) =>
    command === 'db_select' ? [] : null,
  );
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api', baseBranch: 'main' })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionGithub: { [SESSION_ID]: MOUNT_GITHUB },
    mountGithub: { [MOUNT_ID]: MOUNT_GITHUB },
  });
});

afterEach(() => {
  cleanup();
});

const diffOf = (): SessionDiff => ({
  files: [],
  patch: '',
  loading: false,
  isRefreshing: false,
  bodies: null,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
  alternate: null,
  commits: [],
  status: null,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: null,
  focusThreadId: null,
  clearFocus: vi.fn(),
});

type HarnessProps = {
  readonly comments: BranchStepComments;
  readonly review?: BranchReviewCounts;
};

const Harness = ({ comments, review = NO_REVIEW }: HarnessProps) => {
  const controls = useBranchControls({
    sessionId: SESSION_ID,
    worktreePath: MOUNT.worktreePath,
    pr: PR,
    diff: diffOf(),
    review,
    nextStep: 'merge',
    comments,
    mergeLabel: 'Squash and merge',
  });
  return (
    <BranchHeader
      sessionId={SESSION_ID}
      pr={PR}
      fallbackTitle={MOUNT.branch}
      controls={controls}
      isPushBusy={false}
      isPrimaryYielding={false}
      tab="files"
      canEditTitle={false}
      onMutated={vi.fn()}
    />
  );
};

const renderHeader = ({ comments, review }: HarnessProps) =>
  render(
    <ToastProvider>
      <Harness comments={comments} {...(review === undefined ? {} : { review })} />
    </ToastProvider>,
  );

const primaries = (): ReadonlyArray<Element> => [
  ...document.querySelectorAll('[data-branch-primary]'),
];

describe('the branch header comment steps do the work on any tab', () => {
  it('opens the Fix form at Fix N comments and never switches tab', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    useAppStore.setState({ navigate });
    const fixableThreadIds = ['thread-a', 'thread-b', 'thread-c', 'thread-d'];
    renderHeader({
      comments: {
        facts: { ...NO_COMMENT_FACTS, fixable: 4 },
        readyThreadIds: [],
        fixableThreadIds,
      },
    });

    expect(primaries()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fix 4 comments' }));

    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind).toBe('fix-comments');
    expect(drawer?.kind === 'fix-comments' ? drawer.payload.threadIds : null).toEqual(
      fixableThreadIds,
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the comment a fix asks about at Answer, ahead of the push', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    useAppStore.setState({ navigate });
    renderHeader({
      review: { ...NO_REVIEW, accepted: 1, push: { state: 'idle', count: 3 } },
      comments: {
        facts: { ...NO_COMMENT_FACTS, questionThreadId: 'thread-ledger', fixable: 2 },
        readyThreadIds: [],
        fixableThreadIds: [],
      },
    });

    expect(primaries()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({
          view: expect.objectContaining({
            target: expect.objectContaining({ mountPath: MOUNT.worktreePath }),
          }),
        }),
        drawer: {
          kind: 'conversation',
          sessionId: SESSION_ID,
          payload: { threadId: 'thread-ledger' },
        },
      }),
    );
  });

  it('applies the waiting fixes at Apply N fixes and ignores a second press while it runs', async () => {
    let release: () => void = () => undefined;
    const acceptReviewComments = vi.fn<StoreState['acceptReviewComments']>(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ acceptedCount: 2, failures: [] });
        }),
    );
    const clearReviewSelection = vi.fn<StoreState['clearReviewSelection']>();
    useAppStore.setState({ acceptReviewComments, clearReviewSelection });
    renderHeader({
      comments: {
        facts: { ...NO_COMMENT_FACTS, waitingFixes: 2, fixable: 1 },
        readyThreadIds: ['thread-ledger', 'thread-notify'],
        fixableThreadIds: [],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply 2 fixes' }));
    fireEvent.click(primaries()[0] ?? document.body);

    expect(acceptReviewComments).toHaveBeenCalledTimes(1);
    expect(acceptReviewComments).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      threadIds: ['thread-ledger', 'thread-notify'],
    });
    expect(clearReviewSelection).not.toHaveBeenCalled();
    await act(async () => release());
    expect(clearReviewSelection).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('names the failure of Apply and keeps the step to press again', async () => {
    const acceptReviewComments = vi.fn<StoreState['acceptReviewComments']>(async () => ({
      acceptedCount: 0,
      failures: [{ threadId: 'thread-ledger', message: 'GitHub said no' }],
    }));
    const reportError = vi.fn<StoreState['reportError']>(async () => undefined);
    useAppStore.setState({ acceptReviewComments, reportError });
    renderHeader({
      comments: {
        facts: { ...NO_COMMENT_FACTS, waitingFixes: 1 },
        readyThreadIds: ['thread-ledger'],
        fixableThreadIds: [],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply fix' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't accept every comment", sessionId: SESSION_ID }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply fix' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply fix' }));
    await waitFor(() => expect(acceptReviewComments).toHaveBeenCalledTimes(2));
  });

  it('draws no fill while a fix run works on the comments', () => {
    renderHeader({
      comments: {
        facts: { ...NO_COMMENT_FACTS, fixable: 3, isFixRunLive: true },
        readyThreadIds: [],
        fixableThreadIds: [],
      },
    });

    expect(primaries()).toHaveLength(0);
    expect(document.querySelectorAll('[data-branch-secondary]')).toHaveLength(0);
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
  });
});
