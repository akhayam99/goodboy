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
import type { BranchNextStep, BranchReviewCounts } from '../../branchPrimary';
import { useBranchControls } from '../../hooks/useBranchControls';
import { pullRequestStateWordOf } from '../../pullRequestStateWordOf';
import { BranchStateChip } from './BranchStateChip';
import { BRANCH_MENU_DIFF } from '../../branchPrimary';
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
  readonly nextStep?: BranchNextStep;
  readonly hasOpenRebaseStop?: boolean;
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
  nextStep = null,
  hasOpenRebaseStop = false,
  onMutated,
}: HarnessProps) => {
  const controls = useBranchControls({
    sessionId: SESSION_ID,
    worktreePath: MOUNT.worktreePath,
    pr,
    diff: diffOf(),
    review,
    nextStep,
    hasOpenRebaseStop,
    mergeLabel: 'Squash and merge',
  });
  return (
    <BranchHeader
      sessionId={SESSION_ID}
      pr={pr}
      fallbackTitle="feat/export"
      controls={controls}
      isPushBusy={false}
      isPrimaryYielding={isPrimaryYielding}
      tab="pr"
      isActive={isActive}
      canEditTitle={canEditTitle}
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
  nextStep,
  hasOpenRebaseStop,
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
        nextStep={nextStep}
        hasOpenRebaseStop={hasOpenRebaseStop}
        onMutated={onMutated}
      />
    </ToastProvider>,
  );

const titleRowOf = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-slot="pane-title-row"]');
  if (row === null) {
    throw new Error('the header has no title row');
  }
  return row;
};

describe('BranchHeader one row', () => {
  it('holds the title and the actions on one row, with no state chip and no meta line', () => {
    status = statusOf({});
    renderHeader({ pr: { ...PR, author: 'Maya Ortiz' } });

    expect(titleRowOf().textContent).toContain('Ledger export');
    expect(document.querySelector('[data-slot="branch-state"]')).toBeNull();
    expect(titleRowOf().nextElementSibling?.textContent ?? '').toBe('');
    const header = titleRowOf().parentElement?.textContent ?? '';
    expect(header).not.toMatch(/#318|Maya Ortiz|commit|feat\/export/);
  });

  it('carries one h1, the pull request title or the branch name', () => {
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

  it('says how to leave the title edit under the title while it is being edited', () => {
    status = statusOf({});
    renderHeader({ pr: PR, canEditTitle: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger export' }));

    expect(screen.getByText('Enter saves, Esc cancels')).toBeDefined();
  });
});

describe('BranchHeader state chip', () => {
  const CASES: ReadonlyArray<PullRequestPresentationState> = [
    'none',
    'draft',
    'open',
    'approved',
    'queued',
    'merged',
    'closed',
  ];

  it.each(CASES)('reads the tone of %s from the table and its word from the one map', (state) => {
    render(<BranchStateChip state={state} host="github" />);

    const chip = document.querySelector<HTMLElement>('[data-slot="branch-state"]');
    const expected = PULL_REQUEST_PRESENTATION[state];
    expect(chip?.getAttribute('data-state')).toBe(state);
    expect(chip?.getAttribute('data-tone')).toBe(expected.tone);
    expect(chip?.textContent).toBe(pullRequestStateWordOf({ state }) ?? 'No pull request');
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
    renderHeader({ pr: draft, nextStep: 'markReady' });

    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.textContent).toBe('Mark ready for review');
  });

  it('offers the merge method as the one primary of a pull request ready to merge', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = statusOf({});
    renderHeader({ pr: open, nextStep: 'merge' });

    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.textContent).toBe('Squash and merge');
  });

  it('opens the tab that holds the fix for Fix checks and Fix comments', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = statusOf({});
    renderHeader({ pr: open, nextStep: 'fixChecks' });

    expect(primaries()[0]?.getAttribute('data-branch-primary')).toBe('tab.checks');
    expect(primaries()[0]?.textContent).toBe('Fix checks');
  });

  it('offers Reopen as the one primary of a closed pull request and no Merge', () => {
    const closed: PullRequestState = { ...PR, isDraft: false, state: 'closed' };
    withRequest(closed);
    status = statusOf({});
    renderHeader({ pr: closed, nextStep: 'reopen' });

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
  });

  it('draws no primary for a queued pull request and leaves the queue to the property block', () => {
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
    expect(screen.queryByTestId('branch-queue-line')).toBeNull();
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
      nextStep: 'merge',
    });

    const push = screen.getByRole('button', { name: /^Push 1 fix$/ });
    const primary = primaries()[0] as HTMLElement;
    const more = screen.getByRole('button', { name: 'Branch actions' });
    expect(push.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Abort rebase off the header and its menu while a rebase stopped, the status line owns it', () => {
    withMountPr();
    status = statusOf({ changed: 3, inProgress: 'rebase' });
    renderHeader({ pr: PR });

    expect(screen.queryByRole('button', { name: 'Abort rebase' })).toBeNull();
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    const more = screen.queryByRole('button', { name: 'Branch actions' });
    if (more !== null) {
      fireEvent.click(more);
    }
    expect(screen.queryByRole('menuitem', { name: /Abort rebase/ })).toBeNull();
  });

  it('offers no Rebase in the header while behind, the worktree status line owns it', () => {
    withMountPr();
    status = statusOf({ behind: 18 });
    renderHeader({ pr: PR });

    expect(screen.queryByRole('button', { name: /Rebase on main/ })).toBeNull();
  });
});

describe('BranchHeader blocked reason', () => {
  it('never draws a disabled primary: a blocked Merge waits in the menu with its reason', () => {
    const readyPr: PullRequestState = { ...PR, isDraft: false, checks: 'pending' };
    withRequest(readyPr);
    status = statusOf({});
    renderHeader({ pr: readyPr, nextStep: 'merge' });

    expect(primaries()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull();
    expect(titleRowOf().textContent).not.toMatch(/still running/);
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    const merge = screen.getByRole('menuitem', { name: /Merge/ });
    expect(merge.getAttribute('aria-disabled')).toBe('true');
  });

  it('gives up the primary and the push while a rebase stop is open, the stop panel owns them', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = {
      ...statusOf({}),
      upstreamDistance: { kind: 'known', ahead: 2, behind: 0 },
    };
    renderHeader({ pr: open, nextStep: 'merge', hasOpenRebaseStop: true });

    expect(primaries()).toHaveLength(0);
    expect(secondaries()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Push 2 commits/ })).toBeNull();
  });

  it('keeps Force push out of the header while the online copy moved, in the menu behind its confirm', () => {
    const open: PullRequestState = { ...PR, isDraft: false };
    withRequest(open);
    status = {
      ...statusOf({}),
      upstreamDistance: { kind: 'known', ahead: 2, behind: 1 },
    };
    renderHeader({ pr: open });

    expect(screen.queryByRole('button', { name: /Force push/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    expect(screen.getByRole('menuitem', { name: /Force push 3 commits/ })).toBeDefined();
  });
});

describe('BranchHeader action row', () => {
  it('ends on Branch actions after the one primary, both at the 28px control height', () => {
    const draft: PullRequestState = { ...PR, isDraft: true };
    withRequest(draft);
    status = statusOf({});
    renderHeader({ pr: draft, nextStep: 'markReady' });

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
    renderHeader({ pr: open, isPrimaryYielding: true, nextStep: 'merge' });
    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]?.getAttribute('data-variant')).toBe('secondary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
    cleanup();

    renderHeader({ pr: open, isPrimaryYielding: false, nextStep: 'merge' });
    expect(primaries()[0]?.getAttribute('data-variant')).toBe('primary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
  });
});

describe('BranchHeader overflow', () => {
  it('holds the pull request verbs and Change base, never a worktree verb of the identity menu', () => {
    expect(BRANCH_MENU_DIFF).toEqual(['diff.push', 'diff.changeBase', 'diff.copyPatch']);
    withMountPr();
    status = statusOf({ changed: 3 });
    renderHeader({ pr: PR });

    const more = screen.queryByRole('button', { name: 'Branch actions' });
    if (more !== null) {
      fireEvent.click(more);
    }
    const labels = screen.queryAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.startsWith('Copy branch name'))).toBe(false);
    expect(labels.some((label) => label.startsWith('Open terminal'))).toBe(false);
    expect(labels.some((label) => /Edit commits|Restore a backup/.test(label))).toBe(false);
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

    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Force push 3 commits/ }));
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
