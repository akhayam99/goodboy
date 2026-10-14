// @vitest-environment happy-dom

const t = vi.hoisted(() => ({ isOffline: false }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() =>
    t.isOffline ? Promise.reject(new Error('offline')) : new Promise<never>(() => undefined),
  ),
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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { TEST_NOW, aProject, aSession } from '@goodboy/types/testing';
import { branchPlace } from '../../../../store/slices/navigation/place';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/pullRequestPresentation';
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
  t.isOffline = false;
});

const IDLE_PUSH: BranchReviewCounts['push'] = { state: 'idle', count: 0 };

const NO_REVIEW: BranchReviewCounts = {
  accepted: 0,
  replies: 0,
  failed: 0,
  isPushing: false,
  push: IDLE_PUSH,
};

type HarnessProps = {
  readonly pr: PullRequestState | null;
  readonly review: BranchReviewCounts;
  readonly canEditTitle?: boolean;
  readonly isActive?: boolean;
  readonly isPrimaryYielding?: boolean;
  readonly commitCount?: number | null;
  readonly onMutated?: () => void;
};

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
  focusThreadId: null,
  clearFocus: vi.fn(),
});

const Harness = ({
  pr,
  review,
  canEditTitle = false,
  isActive = true,
  isPrimaryYielding = false,
  commitCount = null,
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
      commitCount={commitCount}
      onMutated={onMutated ?? vi.fn()}
    />
  );
};

const renderHeader = ({
  pr = null,
  review = NO_REVIEW,
  canEditTitle,
  isActive,
  isPrimaryYielding,
  commitCount,
  onMutated,
}: Partial<HarnessProps> = {}) =>
  render(
    <ToastProvider>
      <Harness
        pr={pr}
        review={review}
        canEditTitle={canEditTitle}
        isActive={isActive}
        isPrimaryYielding={isPrimaryYielding}
        commitCount={commitCount}
        onMutated={onMutated}
      />
    </ToastProvider>,
  );

const metaOf = (): HTMLElement => {
  const row = document.querySelector('[data-slot="pane-title-row"]')?.nextElementSibling;
  if (!(row instanceof HTMLElement)) {
    throw new Error('the header has no meta line');
  }
  return row;
};

const chipState = (): HTMLElement => {
  const chip = document.querySelector<HTMLElement>('[data-slot="branch-state"]');
  if (chip === null) {
    throw new Error('the header has no state chip');
  }
  return chip;
};

describe('BranchHeader identity', () => {
  it('names the pull request in the chip and the project, branches and number in one line', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, author: 'Maya Ortiz' }, commitCount: 7 });

    expect(screen.getByText('Ledger export')).toBeDefined();
    expect(chipState().textContent).toBe('Draft');
    const meta = metaOf().textContent ?? '';
    expect(meta).toContain('payments-api');
    expect(meta).toContain('feat/export');
    expect(meta).toContain('main');
    expect(meta).toContain('#318 by Maya Ortiz');
    expect(meta).toContain('7 commits');
  });

  it('says one commit in the singular and leaves the count out while it is unknown', () => {
    status = statusOf({});
    renderHeader({ pr: PR, commitCount: 1 });
    expect(metaOf().textContent).toContain('1 commit');
    expect(metaOf().textContent).not.toContain('1 commits');
    cleanup();

    renderHeader({ pr: PR, commitCount: null });
    expect(metaOf().textContent).not.toMatch(/commit/);
  });

  it('falls back to the branch name and a No pull request chip when there is no pull request', () => {
    status = statusOf({ upstream: null });
    renderHeader();

    expect(screen.getByText('feat/export')).toBeDefined();
    expect(chipState().textContent).toBe('No pull request');
    expect(chipState().getAttribute('data-state')).toBe('none');
  });

  it('carries one h1, the pull request title or the branch name, and keeps the chip out of it', () => {
    status = statusOf({});
    renderHeader({ pr: PR });
    const withPr = screen.getAllByRole('heading', { level: 1 });
    expect(withPr).toHaveLength(1);
    expect(withPr[0]?.textContent).toBe('Ledger export');
    expect(withPr[0]?.contains(chipState())).toBe(false);
    cleanup();

    renderHeader();
    const without = screen.getAllByRole('heading', { level: 1 });
    expect(without).toHaveLength(1);
    expect(without[0]?.textContent).toBe('feat/export');
  });

  it('prints the branch name once in the meta line, between the project and the base', () => {
    status = statusOf({});
    renderHeader({ pr: PR });

    const meta = metaOf().textContent ?? '';
    expect(meta.split('feat/export')).toHaveLength(2);
    expect(meta).toMatch(/payments-api.*feat\/export.*main/);
  });

  it('shows no checks word in the meta line, the Overview and the rail own it', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, checks: 'failure' } });

    expect(metaOf().textContent).not.toMatch(/check|failing/i);
  });
});

describe('BranchHeader state chip', () => {
  const CASES: ReadonlyArray<{
    readonly pr: PullRequestState | null;
    readonly state: PullRequestPresentationState;
  }> = [
    { pr: null, state: 'none' },
    { pr: { ...PR, isDraft: true }, state: 'draft' },
    { pr: { ...PR, isDraft: false }, state: 'open' },
    { pr: { ...PR, isDraft: false, state: 'approved' }, state: 'approved' },
    { pr: { ...PR, isDraft: false, state: 'queued' }, state: 'queued' },
    { pr: { ...PR, isDraft: false, state: 'merged' }, state: 'merged' },
    { pr: { ...PR, isDraft: false, state: 'closed' }, state: 'closed' },
  ];

  it.each(CASES)('reads the word and the tone of $state from the presentation table', (item) => {
    status = statusOf({});
    renderHeader({ pr: item.pr });

    const expected = PULL_REQUEST_PRESENTATION[item.state];
    expect(chipState().getAttribute('data-state')).toBe(item.state);
    expect(chipState().getAttribute('data-tone')).toBe(expected.tone);
    expect(chipState().textContent).toBe(
      item.state === 'none' ? 'No pull request' : expected.label,
    );
  });

  it('draws Merged in the merged tone and Queued in the primary tone', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, isDraft: false, state: 'merged' } });
    expect(chipState().getAttribute('data-tone')).toBe('merged');
    cleanup();

    renderHeader({ pr: { ...PR, isDraft: false, state: 'queued' } });
    expect(chipState().getAttribute('data-tone')).toBe('primary');
  });

  it('keeps the chip out of the way while the title is being edited', () => {
    status = statusOf({});
    renderHeader({ pr: PR, canEditTitle: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger export' }));

    expect(document.querySelector('[data-slot="branch-state"]')).toBeNull();
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

  it('shows a chevron with several branches and none with one, which opens the New branch form at once', async () => {
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
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Branch name' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('textbox', { name: 'Branch name' })).toBeNull();
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

const primaries = (): ReadonlyArray<Element> => [
  ...document.querySelectorAll('[data-branch-primary]'),
];

const secondaries = (): ReadonlyArray<Element> => [
  ...document.querySelectorAll('[data-branch-secondary]'),
];

const withRequest = (pr: PullRequestState): void => {
  useAppStore.setState({
    sessionGithub: { [SESSION_ID]: { ...MOUNT_GITHUB, pr } },
    mountGithub: { [MOUNT_ID]: { ...MOUNT_GITHUB, pr } },
  });
};

describe('BranchHeader actions by state', () => {
  it('draws no primary with no pull request, the form owns Create', () => {
    status = statusOf({ upstream: null });
    renderHeader();

    expect(primaries()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Create PR/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rebase on main' })).toBeNull();
  });

  it('offers Mark ready for review as the one primary of a draft', async () => {
    const draft: PullRequestState = { ...PR, isDraft: true };
    withRequest(draft);
    status = statusOf({});
    renderHeader({ pr: draft });

    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.textContent).toBe('Mark ready for review');
  });

  it('offers Merge as the one primary of an open pull request', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = statusOf({});
    renderHeader({ pr: open });

    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.textContent).toMatch(/Merge/);
  });

  it('offers Reopen as the one primary of a closed pull request and no Merge', () => {
    const closed: PullRequestState = { ...PR, isDraft: false, state: 'closed' };
    withRequest(closed);
    status = statusOf({});
    renderHeader({ pr: closed });

    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.textContent).toBe('Reopen');
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    expect(screen.queryByRole('menuitem', { name: /Reopen/ })).toBeNull();
  });

  it('draws no primary and no push for a merged pull request', () => {
    const merged: PullRequestState = { ...PR, isDraft: false, state: 'merged' };
    withRequest(merged);
    status = statusOf({});
    renderHeader({
      pr: merged,
      review: { accepted: 2, replies: 0, failed: 0, isPushing: false, push: IDLE_PUSH },
    });

    expect(primaries()).toHaveLength(0);
    expect(secondaries()).toHaveLength(0);
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
    expect(chipState().getAttribute('data-tone')).toBe('merged');
  });

  it('draws no primary for a queued pull request and names its place in the queue', () => {
    const queued: PullRequestState = {
      ...PR,
      isDraft: false,
      state: 'queued',
      mergeQueue: { position: 3 },
    };
    withRequest(queued);
    status = statusOf({});
    renderHeader({ pr: queued });

    expect(primaries()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull();
    expect(screen.getByTestId('branch-queue-line').textContent).toBe(
      'Queued to merge, 3rd in line',
    );
  });

  it('says a queued pull request with auto-merge merges when the checks pass', () => {
    const queued: PullRequestState = { ...PR, isDraft: false, state: 'queued', isAutoMerge: true };
    withRequest(queued);
    status = statusOf({});
    renderHeader({ pr: queued });

    expect(screen.getByTestId('branch-queue-line').textContent).toBe('Merges when checks pass');
  });

  it('adds Cancel auto-merge to the menu of a queued pull request that allows it', () => {
    const queued: PullRequestState = { ...PR, isDraft: false, state: 'queued', isAutoMerge: true };
    withRequest(queued);
    status = statusOf({});
    renderHeader({ pr: queued });

    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));

    expect(screen.getByRole('menuitem', { name: /Cancel auto-merge/ })).toBeDefined();
  });

  it('puts Push N as the secondary ahead of Publish and Retry, counting the accepted threads', () => {
    withMountPr();
    status = statusOf({});
    renderHeader({
      pr: PR,
      review: { accepted: 3, replies: 2, failed: 1, isPushing: false, push: IDLE_PUSH },
    });

    expect(
      screen.getByRole('button', { name: /^Push 3 fixes$/ }).getAttribute('data-variant'),
    ).toBe('secondary');
    expect(secondaries()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  });

  it('publishes replies with no commit to push, then retries a failed push', () => {
    withMountPr();
    status = statusOf({});
    renderHeader({
      pr: PR,
      review: { accepted: 0, replies: 2, failed: 1, isPushing: false, push: IDLE_PUSH },
    });
    expect(screen.getByRole('button', { name: /Publish 2 replies/ })).toBeDefined();
    cleanup();

    renderHeader({
      pr: PR,
      review: { accepted: 0, replies: 0, failed: 1, isPushing: false, push: IDLE_PUSH },
    });
    expect(screen.getByRole('button', { name: 'Retry push' })).toBeDefined();
  });

  it('keeps the push next to the primary, secondary first', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = statusOf({});
    renderHeader({
      pr: open,
      review: { accepted: 1, replies: 0, failed: 0, isPushing: false, push: IDLE_PUSH },
    });

    const push = screen.getByRole('button', { name: /^Push 1 fix$/ });
    const primary = primaries()[0] as HTMLElement;
    const more = screen.getByRole('button', { name: 'Branch actions' });
    expect(push.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Abort rebase beside the stopped rebase and confirms it inline', () => {
    withMountPr();
    status = statusOf({ changed: 3, inProgress: 'rebase' });
    renderHeader({ pr: PR });

    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));

    const confirm = screen.getByRole('group', { name: 'Abort the rebase?' });
    expect(within(confirm).getByRole('button', { name: 'Abort rebase' })).toBeDefined();
  });

  it('offers Rebase on main as a secondary while the branch is behind its base', () => {
    withMountPr();
    status = statusOf({ behind: 18 });
    renderHeader({ pr: PR });

    expect(screen.getByRole('button', { name: /Rebase on main/ })).toBeDefined();
  });

  it('offers no Rebase on main once the branch is level with its base', () => {
    withMountPr();
    status = statusOf({ behind: 0 });
    renderHeader({ pr: PR });

    expect(screen.queryByRole('button', { name: /Rebase on main/ })).toBeNull();
  });
});

describe('BranchHeader merge state', () => {
  it('keeps a blocked merge reason in the meta line, never in a stray line under the primary', () => {
    const readyPr: PullRequestState = { ...PR, isDraft: false, checks: 'pending' };
    withRequest(readyPr);
    status = statusOf({});
    renderHeader({
      pr: readyPr,
      review: { accepted: 1, replies: 0, failed: 0, isPushing: false, push: IDLE_PUSH },
    });

    expect(screen.getByRole('button', { name: /^Push 1 fix$/ })).toBeDefined();
    const reasons = screen.getAllByText(/still running/);
    expect(reasons).toHaveLength(1);
    expect(metaOf().contains(reasons[0] as HTMLElement)).toBe(true);
    expect(screen.queryByText('Squash and merge')).toBeNull();
  });
});

describe('BranchHeader blocked reason', () => {
  const readyPr: PullRequestState = { ...PR, isDraft: false, checks: 'pending' };

  it('prints why Merge is blocked in the meta line, beside the tooltip', () => {
    withRequest(readyPr);
    status = statusOf({});
    renderHeader({ pr: readyPr });

    const merge = screen.getByRole('button', { name: /Merge/ }) as HTMLButtonElement;
    expect(merge.disabled).toBe(true);
    const reason = screen.getByTestId('branch-blocked-reason');
    expect(reason.textContent).toMatch(/still running/);
    expect(metaOf().contains(reason)).toBe(true);
  });

  it('leaves the meta line alone when the primary can run', () => {
    const clear: PullRequestState = { ...PR, isDraft: false };
    withRequest(clear);
    status = statusOf({});
    renderHeader({ pr: clear });

    expect(screen.queryByTestId('branch-blocked-reason')).toBeNull();
  });
});

describe('BranchHeader action row', () => {
  it('ends on Branch actions after the one primary, both at the 28px control height', () => {
    const draft: PullRequestState = { ...PR, isDraft: true };
    withRequest(draft);
    status = statusOf({});
    renderHeader({ pr: draft });

    const primary = screen.getByRole('button', { name: /Mark ready for review/ });
    const more = screen.getByRole('button', { name: 'Branch actions' });
    expect(primaries()).toHaveLength(1);
    expect(primary.getAttribute('data-size')).toBe('sm');
    expect(more.getAttribute('data-size')).toBe('control');
    expect(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.closest('h1')).toBeNull();
    expect(more.closest('[data-slot="header-actions"]')?.contains(primary)).toBe(true);
  });

  it('turns the primary into a secondary while its own confirm is open and back when it closes', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = statusOf({});
    renderHeader({ pr: open, isPrimaryYielding: true });
    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.getAttribute('data-variant')).toBe('secondary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
    cleanup();

    renderHeader({ pr: open, isPrimaryYielding: false });
    expect(primaries()[0]?.getAttribute('data-variant')).toBe('primary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
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

describe('BranchHeader push failure', () => {
  const open: PullRequestState = { ...PR, isDraft: false };
  type UpstreamAtParams = {
    readonly ahead: number;
    readonly behind: number;
  };
  const upstreamAt = ({ ahead, behind }: UpstreamAtParams) => ({
    ...statusOf({}),
    upstreamDistance: { kind: 'known' as const, ahead, behind },
  });

  type FailPushWithParams = {
    readonly error: string;
  };

  const failPushWith = ({ error }: FailPushWithParams) => {
    const fixBranchPushWithAgent = vi.fn<StoreState['fixBranchPushWithAgent']>(async () => {});
    const prefillBranchPushTerminal = vi.fn<StoreState['prefillBranchPushTerminal']>(
      async () => {},
    );
    useAppStore.setState({
      pushSessionBranch: vi.fn<StoreState['pushSessionBranch']>(async () => ({ ok: false, error })),
      forcePushSessionBranch: vi.fn<StoreState['forcePushSessionBranch']>(async () => ({
        ok: false,
        error,
      })),
      fixBranchPushWithAgent,
      prefillBranchPushTerminal,
    });
    return { fixBranchPushWithAgent, prefillBranchPushTerminal };
  };

  it('offers Fix with agent and Open terminal here beside Retry when a plain push fails', async () => {
    withRequest(open);
    status = upstreamAt({ ahead: 2, behind: 0 });
    const { fixBranchPushWithAgent, prefillBranchPushTerminal } = failPushWith({
      error: 'pre-push hook declined',
    });
    renderHeader({ pr: open });

    fireEvent.click(screen.getByRole('button', { name: 'Push 2 commits' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('pre-push hook declined');

    fireEvent.click(within(alert).getByRole('button', { name: 'Fix with agent' }));
    await waitFor(() => expect(fixBranchPushWithAgent).toHaveBeenCalledTimes(1));
    expect(fixBranchPushWithAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      isForce: false,
      confirmedOnlyOnline: null,
      confirmedRemoteSha: null,
      message: 'pre-push hook declined',
      hint: '',
      onAccepted: expect.any(Function),
    });

    fireEvent.click(within(alert).getByRole('button', { name: 'Open terminal here' }));
    await waitFor(() =>
      expect(prefillBranchPushTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID, mountId: MOUNT_ID, isForce: false }),
      ),
    );
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('sends the hint typed under a failed push to the agent', async () => {
    withRequest(open);
    status = upstreamAt({ ahead: 2, behind: 0 });
    const { fixBranchPushWithAgent } = failPushWith({ error: 'pre-push hook declined' });
    renderHeader({ pr: open });

    fireEvent.click(screen.getByRole('button', { name: 'Push 2 commits' }));
    const alert = await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hint for the Implementer' }), {
      target: { value: 'Keep the pre-push hook as it is.' },
    });
    fireEvent.click(within(alert).getByRole('button', { name: 'Fix with agent' }));

    await waitFor(() =>
      expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
        expect.objectContaining({ hint: 'Keep the pre-push hook as it is.' }),
      ),
    );
  });

  it('offers the same two actions on a failed force push and keeps the force lease', async () => {
    withRequest(open);
    status = upstreamAt({ ahead: 2, behind: 1 });
    const { fixBranchPushWithAgent, prefillBranchPushTerminal } = failPushWith({
      error: 'stale info',
    });
    renderHeader({ pr: open });

    fireEvent.click(screen.getByRole('button', { name: 'Force push 3 commits' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Force push$/ }));
    const alert = await screen.findByRole('alert');

    fireEvent.click(within(alert).getByRole('button', { name: 'Fix with agent' }));
    await waitFor(() =>
      expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
        expect.objectContaining({ isForce: true, message: 'stale info' }),
      ),
    );
    fireEvent.click(within(alert).getByRole('button', { name: 'Open terminal here' }));
    await waitFor(() =>
      expect(prefillBranchPushTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ isForce: true }),
      ),
    );
  });

  it('drops the failure and its recovery buttons once the agent fix pushed', async () => {
    withRequest(open);
    status = upstreamAt({ ahead: 2, behind: 0 });
    failPushWith({ error: 'pre-push hook declined' });
    renderHeader({ pr: open });

    fireEvent.click(screen.getByRole('button', { name: 'Push 2 commits' }));
    await screen.findByRole('alert');

    act(() => {
      useAppStore.setState({ settledBranchPushes: { [MOUNT_ID]: 1 } });
    });

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Open terminal here' })).toBeNull();
  });
});

describe('BranchHeader push feedback', () => {
  const open: PullRequestState = { ...PR, isDraft: false };
  const pushStatus = (): WorktreeStatus => ({
    ...statusOf({ ahead: 1 }),
    upstreamDistance: { kind: 'known', ahead: 1, behind: 0 },
  });

  type PushResult = Awaited<ReturnType<StoreState['pushSessionBranch']>>;
  type Deferred = {
    readonly promise: Promise<PushResult>;
    readonly resolve: () => void;
  };

  const deferredPush = (): Deferred => {
    let resolve: () => void = () => undefined;
    const promise = new Promise<PushResult>((done) => {
      resolve = () => done({ ok: true });
    });
    return { promise, resolve };
  };

  const setup = () => {
    t.isOffline = true;
    withRequest(open);
    status = pushStatus();
    const gate = deferredPush();
    const pushSessionBranch = vi.fn<StoreState['pushSessionBranch']>(() => gate.promise);
    useAppStore.setState({ pushSessionBranch });
    renderHeader({ pr: open });
    return { gate, pushSessionBranch };
  };

  it('shows the busy word on the button while the push runs and ignores a second click', async () => {
    const { gate, pushSessionBranch } = setup();

    const button = screen.getByRole('button', { name: 'Push 1 commit' });
    fireEvent.click(button);
    fireEvent.click(button);

    const busy = await screen.findByRole('button', { name: 'Pushing…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.hasAttribute('disabled')).toBe(true);
    fireEvent.click(busy);
    expect(pushSessionBranch).toHaveBeenCalledTimes(1);

    await act(async () => gate.resolve());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pushing…' })).toBeNull());
  });

  it('says what happened after the push, even while the count has not refreshed', async () => {
    const { gate } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push 1 commit' }));
    await act(async () => gate.resolve());

    const line = await screen.findByRole('status');
    expect(line.textContent).toContain('Pushed 1 commit to origin.');
    expect(screen.getByRole('button', { name: 'Push 1 commit' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(within(line).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('clears the outcome line when the next action starts', async () => {
    const { gate, pushSessionBranch } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push 1 commit' }));
    await act(async () => gate.resolve());
    await screen.findByRole('status');

    const second = deferredPush();
    pushSessionBranch.mockImplementationOnce(() => second.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Push 1 commit' }));

    await screen.findByRole('button', { name: 'Pushing…' });
    expect(screen.queryByRole('status')).toBeNull();
    await act(async () => second.resolve());
    await waitFor(() => expect(screen.getByRole('status')).toBeDefined());
  });

  it('shows the failure line with Retry and no outcome when the push fails', async () => {
    t.isOffline = true;
    withRequest(open);
    status = pushStatus();
    useAppStore.setState({
      pushSessionBranch: vi.fn<StoreState['pushSessionBranch']>(async () => ({
        ok: false,
        error: 'pre-push hook declined',
      })),
    });
    renderHeader({ pr: open });

    fireEvent.click(screen.getByRole('button', { name: 'Push 1 commit' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('pre-push hook declined');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pushing…' })).toBeNull();
  });
});
