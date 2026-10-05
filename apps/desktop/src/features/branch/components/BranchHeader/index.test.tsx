// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

const h = vi.hoisted(() => ({
  prediction: null as null | { conflictFiles: ReadonlyArray<string>; isClean: boolean },
}));

vi.mock('../../../history/useRebasePrediction', () => ({
  useRebasePrediction: () => h.prediction,
}));

vi.mock('../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => 'github',
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  MountId,
  PrCheckRun,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import type { MountGithubState } from '../../../../store/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import type { BranchReviewCounts } from '../../branchPrimary';
import { useBranchControls } from '../../hooks/useBranchControls';
import { BranchHeader } from './index';

const SESSION_ID = 'session-ledger-export' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;

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
  isDraft: true,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let status: WorktreeStatus | null = null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const statusOf = ({
  upstream = 'origin/feat/export',
  ahead = 3,
  behind = 0,
  changed = 0,
  inProgress = null,
}: {
  readonly upstream?: string | null;
  readonly ahead?: number;
  readonly behind?: number;
  readonly changed?: number;
  readonly inProgress?: WorktreeStatus['inProgress'];
}): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: null,
  headSubject: null,
  upstream,
  mainDistance: { kind: 'known', ahead, behind },
  upstreamDistance:
    upstream === null
      ? { kind: 'unknown', reason: 'no-upstream' }
      : { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged: 0, changed },
  inProgress,
});

const MOUNT_GITHUB: MountGithubState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: null,
  host: null,
  branch: MOUNT.branch,
  prs: [],
  links: [],
  pr: { ...PR, isDraft: false },
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

const withMountPr = (): void => {
  useAppStore.setState({ mountGithub: { [MOUNT_ID]: MOUNT_GITHUB } });
};

beforeEach(async () => {
  await resetStoryStore();
  status = null;
  h.prediction = null;
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api', baseBranch: 'main' })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    rebaseBranch: vi.fn<StoreState['rebaseBranch']>(async () => 'rebased'),
    openMountRequest: vi.fn<StoreState['openMountRequest']>(async () => ({
      kind: 'opened',
    })),
  });
});

afterEach(() => {
  cleanup();
});

const NO_REVIEW: BranchReviewCounts = { accepted: 0, replies: 0, failed: 0, isPushing: false };
const NO_CHECKS: ReadonlyArray<PrCheckRun> = [];

type HarnessProps = {
  readonly pr: PullRequestState | null;
  readonly review: BranchReviewCounts;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const diffOf = (): SessionDiff => ({
  files: [],
  patch: '',
  loading: false,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
  commits: [],
  status,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: null,
  clearFocus: vi.fn(),
  focusFile: vi.fn(),
});

const Harness = ({ pr, review, checks }: HarnessProps) => {
  const controls = useBranchControls({
    sessionId: SESSION_ID,
    worktreePath: MOUNT.worktreePath,
    pr,
    diff: diffOf(),
    review,
  });
  return (
    <BranchHeader
      pr={pr}
      checks={checks}
      projectName="payments-api"
      branch={MOUNT.branch}
      baseBranch="main"
      fallbackTitle="feat/export"
      controls={controls}
      isPushBusy={false}
    />
  );
};

const renderHeader = ({
  pr = null,
  review = NO_REVIEW,
  checks = NO_CHECKS,
}: Partial<HarnessProps> = {}) =>
  render(
    <ToastProvider>
      <Harness pr={pr} review={review} checks={checks} />
    </ToastProvider>,
  );

describe('BranchHeader identity', () => {
  it('names the pull request, its state, project, branches and checks in one line', () => {
    status = statusOf({});
    renderHeader({
      pr: PR,
      checks: [
        { name: 'build', conclusion: 'success', detailsUrl: null, durationMs: 1 },
        { name: 'lint', conclusion: 'success', detailsUrl: null, durationMs: 1 },
      ],
    });

    expect(screen.getByText('#318')).toBeDefined();
    expect(screen.getByText('Ledger export')).toBeDefined();
    const meta = screen.getByText('Draft').closest('p') as HTMLElement;
    expect(meta.textContent).toContain('payments-api');
    expect(meta.textContent).toContain('feat/export');
    expect(meta.textContent).toContain('main');
    expect(meta.textContent).toContain('2 checks');
  });

  it('falls back to the branch name when there is no pull request', () => {
    status = statusOf({ upstream: null });
    renderHeader();

    expect(screen.getByText('feat/export')).toBeDefined();
    expect(screen.getByText('No pull request')).toBeDefined();
  });
});

describe('BranchHeader one primary by state', () => {
  it('rebases on main as the one primary when the branch is behind', async () => {
    withMountPr();
    status = statusOf({ behind: 18 });
    renderHeader({ pr: PR });

    fireEvent.click(screen.getByRole('button', { name: 'Rebase on main' }));

    await waitFor(() =>
      expect(useAppStore.getState().rebaseBranch).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
      }),
    );
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
  });

  it('names the predicted conflict on the rebase button before anything runs', () => {
    withMountPr();
    status = statusOf({ behind: 18 });
    h.prediction = { conflictFiles: ['src/ledger/postings.ts'], isClean: false };
    renderHeader({ pr: PR });

    expect(screen.getByRole('button', { name: /Rebase on main · 1 conflict/ })).toBeDefined();
  });

  it('keeps Rebase visible and disabled with its reason while changes are uncommitted', () => {
    withMountPr();
    status = statusOf({ behind: 4, changed: 2 });
    renderHeader({ pr: PR });

    const rebase = screen.getByRole('button', { name: /Rebase on main/ }) as HTMLButtonElement;
    expect(rebase.disabled).toBe(true);
  });

  it('offers Create PR on a branch with commits and no pull request', async () => {
    status = statusOf({ upstream: null });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /Create PR/ }));

    await waitFor(() =>
      expect(useAppStore.getState().openMountRequest).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        provider: 'github',
      }),
    );
  });

  it('puts Push N ahead of Publish and Retry, counting the accepted threads', () => {
    withMountPr();
    status = statusOf({});
    renderHeader({
      pr: PR,
      review: { accepted: 3, replies: 2, failed: 1, isPushing: false },
    });

    expect(screen.getByRole('button', { name: /^Push 3$/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  });

  it('publishes replies with no commit to push, then retries a failed push', () => {
    withMountPr();
    status = statusOf({});
    renderHeader({ pr: PR, review: { accepted: 0, replies: 2, failed: 1, isPushing: false } });
    expect(screen.getByRole('button', { name: /Publish 2 replies/ })).toBeDefined();
    cleanup();

    renderHeader({ pr: PR, review: { accepted: 0, replies: 0, failed: 1, isPushing: false } });
    expect(screen.getByRole('button', { name: /Retry 1/ })).toBeDefined();
  });

  it('keeps Abort rebase as the secondary of a stopped rebase and confirms it inline', () => {
    withMountPr();
    status = statusOf({ changed: 3, inProgress: 'rebase' });
    renderHeader({ pr: PR });

    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));

    const confirm = screen.getByRole('group', { name: 'Abort the rebase?' });
    expect(within(confirm).getByRole('button', { name: 'Abort rebase' })).toBeDefined();
  });
});

describe('BranchHeader merge state', () => {
  it('keeps a blocked merge out of a stray line under the primary', () => {
    const readyPr: PullRequestState = { ...PR, isDraft: false, checks: 'pending' };
    useAppStore.setState({
      sessionGithub: { [SESSION_ID]: { ...MOUNT_GITHUB, pr: readyPr } },
      mountGithub: { [MOUNT_ID]: { ...MOUNT_GITHUB, pr: readyPr } },
    });
    status = statusOf({});
    renderHeader({
      pr: readyPr,
      review: { accepted: 1, replies: 0, failed: 0, isPushing: false },
    });

    expect(screen.getByRole('button', { name: /^Push 1$/ })).toBeDefined();
    expect(screen.queryByText(/Checks are still running/)).toBeNull();
    expect(screen.queryByText('Squash and merge')).toBeNull();
  });
});

describe('BranchHeader overflow', () => {
  it('holds the rare lifecycle and branch actions, and no Rewrite or Restore', () => {
    withMountPr();
    status = statusOf({});
    renderHeader({ pr: PR });

    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.startsWith('Change base branch'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Copy branch name'))).toBe(true);
    expect(labels.some((label) => /Rewrite history|Restore a backup/.test(label))).toBe(false);
  });
});
