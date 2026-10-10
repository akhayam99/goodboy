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
  PrDetail,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { TEST_NOW, aProject, aSession } from '@goodboy/types/testing';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { MountGithubState } from '../../../../store/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import { branchLandingTabOf } from '../../branchLandingTab';
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
  readonly detail?: PrDetail | null;
  readonly canEditTitle?: boolean;
  readonly isActive?: boolean;
  readonly isPrimaryYielding?: boolean;
  readonly onMutated?: () => void;
};

const detailOf = ({
  pr,
  checks,
}: {
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun>;
}): PrDetail | null =>
  pr === null
    ? null
    : { prNumber: pr.number, comments: [], reviews: [], reviewRequests: [], checks };

const diffOf = (): SessionDiff => ({
  files: [],
  patch: '',
  loading: false,
  isRefreshing: false,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
  alternate: null,
  commits: [],
  status,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: null,
  clearFocus: vi.fn(),
});

const Harness = ({
  pr,
  review,
  checks,
  detail,
  canEditTitle = false,
  isActive = true,
  isPrimaryYielding = false,
  onMutated,
}: HarnessProps) => {
  const controls = useBranchControls({
    sessionId: SESSION_ID,
    worktreePath: MOUNT.worktreePath,
    pr,
    diff: diffOf(),
    review,
  });
  return (
    <BranchHeader
      sessionId={SESSION_ID}
      mountPath={MOUNT.worktreePath}
      pr={pr}
      detail={detail === undefined ? detailOf({ pr, checks }) : detail}
      projectName="payments-api"
      branch={MOUNT.branch}
      baseBranch="main"
      fallbackTitle="feat/export"
      controls={controls}
      isPushBusy={false}
      isPrimaryYielding={isPrimaryYielding}
      tab="pr"
      isActive={isActive}
      canEditTitle={canEditTitle}
      createdAt={null}
      onMutated={onMutated ?? vi.fn()}
    />
  );
};

const renderHeader = ({
  pr = null,
  review = NO_REVIEW,
  checks = NO_CHECKS,
  detail,
  canEditTitle,
  isActive,
  isPrimaryYielding,
  onMutated,
}: Partial<HarnessProps> = {}) =>
  render(
    <ToastProvider>
      <Harness
        pr={pr}
        review={review}
        checks={checks}
        detail={detail}
        canEditTitle={canEditTitle}
        isActive={isActive}
        isPrimaryYielding={isPrimaryYielding}
        onMutated={onMutated}
      />
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

    expect(screen.getByText('Ledger export')).toBeDefined();
    const meta = screen.getByText('Draft').closest('div') as HTMLElement;
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

  it('carries one h1: the pull request title, else the branch name', () => {
    status = statusOf({});
    renderHeader({ pr: PR });
    const withPr = screen.getAllByRole('heading', { level: 1 });
    expect(withPr).toHaveLength(1);
    expect(withPr[0]?.textContent).toBe('Ledger export');
    cleanup();

    renderHeader();
    const without = screen.getAllByRole('heading', { level: 1 });
    expect(without).toHaveLength(1);
    expect(without[0]?.textContent).toBe('feat/export');
  });

  it('prints the branch name once in the meta line, between the state and the base', () => {
    status = statusOf({});
    renderHeader({ pr: PR });

    const meta = screen.getByText('Draft').closest('div') as HTMLElement;
    expect(meta.textContent?.split('feat/export')).toHaveLength(2);
    expect(meta.textContent).toMatch(/^Draft.*payments-api.*feat\/export.*main/);
    expect(screen.queryByText('Open')).toBeNull();
  });

  it('reads Open for an open pull request that is not a draft', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, isDraft: false } });

    expect(screen.getByText('Open')).toBeDefined();
  });
});

describe('BranchHeader checks word', () => {
  const metaOf = (): string =>
    (screen.getByText('Draft').closest('div') as HTMLElement).textContent ?? '';

  it('says Checks unknown when the pull request carries checksUnknown, never 0 checks', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, checksUnknown: true } });

    expect(screen.getByText('Checks unknown')).toBeDefined();
    expect(metaOf()).not.toMatch(/0 checks|checks passed/);
  });

  it('says Checks unknown when the checks read was denied, even with a passing rollup', () => {
    status = statusOf({});
    renderHeader({
      pr: PR,
      detail: {
        prNumber: PR.number,
        comments: [],
        reviews: [],
        reviewRequests: [],
        checks: [],
        checksRead: 'denied',
      },
    });

    expect(screen.getByText('Checks unknown')).toBeDefined();
    expect(metaOf()).not.toMatch(/0 checks/);
  });

  it('says Checks unknown when the checks read failed', () => {
    status = statusOf({});
    renderHeader({
      pr: { ...PR, checks: 'pending' },
      detail: {
        prNumber: PR.number,
        comments: [],
        reviews: [],
        reviewRequests: [],
        checks: [],
        checksRead: 'failed',
      },
    });

    expect(screen.getByText('Checks unknown')).toBeDefined();
    expect(screen.queryByText(/running/)).toBeNull();
  });

  it('keeps the count of a readable rollup', () => {
    status = statusOf({});
    renderHeader({
      pr: PR,
      checks: [
        { name: 'build', conclusion: 'success', detailsUrl: null, durationMs: 1 },
        { name: 'lint', conclusion: 'success', detailsUrl: null, durationMs: 1 },
      ],
    });

    expect(screen.queryByText('Checks unknown')).toBeNull();
    expect(metaOf()).toContain('2 checks');
  });

  it('shows no checks word when there is no pull request', () => {
    status = statusOf({ upstream: null });
    renderHeader();

    expect(screen.queryByText('Checks unknown')).toBeNull();
    expect(screen.queryByText(/checks/)).toBeNull();
  });
});

const MOUNT_FIX: SessionProjectMount = {
  ...MOUNT,
  mountId: 'mount-payments-api-fix' as MountId,
  worktreePath: '/w/payments-api-fix',
  branch: 'hl/fix-duplicate-credit',
  parallelIndex: 1,
};

const MOUNT_DOCS: SessionProjectMount = {
  ...MOUNT,
  mountId: 'mount-payments-api-docs' as MountId,
  worktreePath: '/w/payments-api-docs',
  branch: 'hl/docs-credit-notes',
  parallelIndex: 2,
};

const FORKED: SessionMountView = {
  id: MOUNT_FIX.mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: MOUNT_FIX.worktreePath,
  lastWorktreePath: null,
  branch: 'hl/retry-credit-notes',
  baseBranch: null,
  parallelIndex: 1,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: MOUNT_FIX.repoRoot,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const withMounts = (mounts: ReadonlyArray<SessionProjectMount>): void => {
  useAppStore.setState({
    sessionProjectMounts: { [SESSION_ID]: mounts },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    mountGithub: {
      [MOUNT_FIX.mountId]: {
        ...MOUNT_GITHUB,
        mountId: MOUNT_FIX.mountId,
        branch: MOUNT_FIX.branch,
        pr: { ...PR, number: 331, isDraft: false, headBranch: MOUNT_FIX.branch },
      },
    },
  });
};

const chipOf = (): HTMLElement => screen.getByRole('button', { name: /^Branch feat\/export$/ });

describe('BranchHeader branch switcher', () => {
  it('lists the session branches with their pull request and moves the page to the landing tab of the one picked', async () => {
    const navigate = vi.fn();
    const setSessionActiveMount = vi.fn<StoreState['setSessionActiveMount']>(async () => undefined);
    useAppStore.setState({ navigate, setSessionActiveMount });
    withMounts([MOUNT, MOUNT_FIX, MOUNT_DOCS]);
    useAppStore.setState({ branchTab: { [SESSION_ID]: 'files' } });
    status = statusOf({});
    renderHeader({ pr: PR });

    fireEvent.click(chipOf());

    const rows = await screen.findAllByRole('menuitemradio');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(rows[1]?.textContent).toContain('hl/fix-duplicate-credit');
    expect(rows[1]?.textContent).toContain('#331 Open');
    expect(rows[2]?.textContent).not.toContain('#');
    expect(screen.getByRole('menuitem', { name: 'New branch' })).toBeDefined();

    fireEvent.click(rows[1] as HTMLElement);

    expect(setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_FIX.mountId,
    });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: branchPlace({
          sessionId: SESSION_ID,
          mountPath: MOUNT_FIX.worktreePath,
          tab: branchLandingTabOf({ hasPullRequest: true, deepLink: null }),
        }),
        mode: 'replace',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('menuitemradio')).toBeNull());
  });

  it('shows a chevron with several branches and none with one, which opens only New branch', async () => {
    withMounts([MOUNT, MOUNT_FIX]);
    status = statusOf({});
    renderHeader({ pr: PR });
    expect(chipOf().querySelector('[data-slot="switcher-chevron"]')).not.toBeNull();
    cleanup();

    withMounts([MOUNT]);
    renderHeader({ pr: PR });
    expect(chipOf().querySelector('[data-slot="switcher-chevron"]')).toBeNull();

    fireEvent.click(chipOf());

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['New branch']);
  });

  it('creates a new branch from the chip and lands on it, on the same tab', async () => {
    const navigate = vi.fn();
    const forkMount = vi.fn<StoreState['forkMount']>(async () => FORKED);
    useAppStore.setState({
      navigate,
      forkMount,
      setSessionActiveMount: vi.fn<StoreState['setSessionActiveMount']>(async () => undefined),
    });
    withMounts([MOUNT, MOUNT_FIX]);
    status = statusOf({});
    renderHeader({ pr: PR });

    fireEvent.click(chipOf());
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New branch' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Branch name' }), {
      target: { value: 'hl/retry-credit-notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    await waitFor(() =>
      expect(forkMount).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        branch: 'hl/retry-credit-notes',
      }),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: branchPlace({
          sessionId: SESSION_ID,
          mountPath: MOUNT_FIX.worktreePath,
          tab: branchLandingTabOf({ hasPullRequest: true, deepLink: null }),
        }),
        mode: 'replace',
      }),
    );
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
    expect(screen.getByRole('button', { name: 'Retry push' })).toBeDefined();
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

describe('BranchHeader blocked reason', () => {
  const readyPr: PullRequestState = { ...PR, isDraft: false, checks: 'pending' };

  const withReadyPr = (): void => {
    useAppStore.setState({
      sessionGithub: { [SESSION_ID]: { ...MOUNT_GITHUB, pr: readyPr } },
      mountGithub: { [MOUNT_ID]: { ...MOUNT_GITHUB, pr: readyPr } },
    });
  };

  it('prints why Merge is blocked in the meta line, beside the tooltip', () => {
    withReadyPr();
    status = statusOf({});
    renderHeader({ pr: readyPr });

    const merge = screen.getByRole('button', { name: /Merge/ }) as HTMLButtonElement;
    expect(merge.disabled).toBe(true);
    const reason = screen.getByTestId('branch-blocked-reason');
    expect(reason.textContent).toMatch(/still running/);
    const meta = screen.getByText('Open').closest('div') as HTMLElement;
    expect(meta.contains(reason)).toBe(true);
  });

  it('leaves the meta line alone when the primary can run', () => {
    withReadyPr();
    status = statusOf({});
    renderHeader({
      pr: readyPr,
      review: { accepted: 1, replies: 0, failed: 0, isPushing: false },
    });

    expect(screen.queryByTestId('branch-blocked-reason')).toBeNull();
  });
});

describe('BranchHeader action row', () => {
  it('ends on Branch actions after the one primary, both at the 28px control height', () => {
    status = statusOf({ upstream: null });
    renderHeader();

    const primary = screen.getByRole('button', { name: /Create PR/ });
    const more = screen.getByRole('button', { name: 'Branch actions' });
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
    expect(primary.getAttribute('data-size')).toBe('sm');
    expect(more.getAttribute('data-size')).toBe('control');
    expect(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.closest('h1')).toBeNull();
    expect(more.closest('[data-slot="header-actions"]')?.contains(primary)).toBe(true);
  });

  it('turns the primary into a secondary while its own confirm is open and back when it closes', () => {
    withMountPr();
    status = statusOf({});
    const review = { accepted: 3, replies: 0, failed: 0, isPushing: false };
    renderHeader({ pr: PR, review, isPrimaryYielding: true });
    expect(screen.getByRole('button', { name: /^Push 3$/ }).getAttribute('data-variant')).toBe(
      'secondary',
    );
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
    cleanup();

    renderHeader({ pr: PR, review, isPrimaryYielding: false });
    expect(screen.getByRole('button', { name: /^Push 3$/ }).getAttribute('data-variant')).toBe(
      'primary',
    );
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
  });

  it('keeps Abort rebase first, then the one primary, then Branch actions', () => {
    withMountPr();
    status = statusOf({ changed: 3, inProgress: 'rebase' });
    renderHeader({ pr: PR });

    const abort = screen.getByRole('button', { name: 'Abort rebase' });
    const primary = document.querySelector('[data-branch-primary]') as HTMLElement;
    const more = screen.getByRole('button', { name: 'Branch actions' });
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
    expect(abort.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe('BranchHeader title editing', () => {
  const editPr = vi.fn<StoreState['editPr']>(async () => undefined);

  beforeEach(() => {
    editPr.mockReset();
    editPr.mockResolvedValue(undefined);
    useAppStore.setState({ editPr });
    status = statusOf({});
  });

  it('shows the title as a plain heading when the pull request is not yours', () => {
    renderHeader({ pr: PR, canEditTitle: false });

    expect(screen.queryByRole('button', { name: 'Ledger export' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ledger export');
  });

  it('turns the title into an input on a click and saves on Enter', async () => {
    const onMutated = vi.fn();
    renderHeader({ pr: PR, canEditTitle: true, onMutated });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger export' }));
    const input = screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement;
    expect(input.value).toBe('Ledger export');
    fireEvent.change(input, { target: { value: 'Ledger export, with retries' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onMutated).toHaveBeenCalledTimes(1));
    expect(editPr).toHaveBeenCalledWith(SESSION_ID, 318, {
      title: 'Ledger export, with retries',
      isQuiet: true,
      mountId: MOUNT.mountId,
    });
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
  });

  it('opens on the E key and cancels on Escape without writing', () => {
    renderHeader({ pr: PR, canEditTitle: true });

    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();

    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(editPr).not.toHaveBeenCalled();
  });

  it('ignores the E key while the session sits hidden behind another one', () => {
    renderHeader({ pr: PR, canEditTitle: true, isActive: false });

    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });

    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
  });

  it('ignores the E key when the title cannot be edited', () => {
    renderHeader({ pr: PR, canEditTitle: false });

    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });

    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
  });

  it('keeps the draft, names the failure under the title and retries', async () => {
    editPr.mockRejectedValueOnce(new Error('Resource not accessible by personal access token'));
    renderHeader({ pr: PR, canEditTitle: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger export' }));
    const input = screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ledger export v2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't save the title");
    expect(alert.textContent).toContain('Resource not accessible');
    const kept = screen.getByRole('textbox', { name: 'Pull request title' }) as HTMLInputElement;
    expect(kept.value).toBe('Ledger export v2');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(editPr).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull(),
    );
  });

  it('does not write when the title did not change', async () => {
    renderHeader({ pr: PR, canEditTitle: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger export' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Pull request title' }), {
      key: 'Enter',
    });

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(editPr).not.toHaveBeenCalled();
  });
});
