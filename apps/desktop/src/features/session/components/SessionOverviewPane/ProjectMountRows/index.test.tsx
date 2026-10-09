// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
const status = vi.hoisted((): { clean: WorktreeStatus } => ({
  clean: {
    branch: 'hl/branch',
    head: 'abc',
    headSubject: 'work',
    upstream: 'origin/hl/branch',
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    mainDistance: { kind: 'known', ahead: 1, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    inProgress: null,
  },
}));
vi.mock('../../../../worktree/worktree', async () => ({
  ...(await import('../../../../../store/storyHarness')).worktreeModuleMock(),
  worktreeStatus: async () => status.clean,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  BootstrapPhase,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  PullRequestState,
  PullRequestStateKind,
  Session,
  SessionId,
  SessionMountView,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { mountGridTracksOf } from './mountGrid';
import { ToastProvider } from '../../../../../shared/components/Toast';
import type { MountGithubState } from '../../../../../store/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;
let ProjectMountRows: typeof import('.').ProjectMountRows;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ ProjectMountRows } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;

const session: Session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

const projectOf = (id: string, name: string): Project =>
  aProject({
    id: id as ProjectId,
    workspaceId: WORKSPACE_ID,
    name,
    kind: 'repo',
    rootPath: `/repo/${name}`,
  });

const PAYMENTS = projectOf('payments', 'payments-api');
const LEDGER = projectOf('ledger', 'ledger-core');

type MountParams = {
  readonly id: string;
  readonly project?: Project;
  readonly branch: string;
};

const mountView = ({ id, project = PAYMENTS, branch }: MountParams): SessionMountView => ({
  id: id as MountId,
  sessionId: SESSION_ID,
  projectId: project.id,
  mountName: project.name,
  worktreePath: `/worktrees/${id}`,
  lastWorktreePath: `/worktrees/${id}`,
  repoRoot: project.rootPath,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: `harborline/${project.name}`,
  isAttached: true,
  diskState: 'present',
  revision: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

const githubOf = (
  mountId: string,
  number: number,
  state: PullRequestStateKind,
  headSha: string | null = null,
): MountGithubState => {
  const pr: PullRequestState = {
    headSha,
    number,
    title: `Fix ${number}`,
    url: `https://example.invalid/pull/${number}`,
    state,
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `hl/${mountId}`,
    isDraft: false,
    reviewDecision: 'review_required',
    body: '',
    updatedAt: NOW,
  };
  return {
    pr,
    linkedIssues: [],
    fetchedAt: NOW,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
    mountId: mountId as MountId,
    projectId: PAYMENTS.id,
    revision: 0,
    repository: 'harborline/payments-api',
    host: 'github.com',
    branch: `hl/${mountId}`,
    prs: [pr],
    links: [],
  };
};

type SeedParams = {
  readonly projects?: ReadonlyArray<Project>;
  readonly mounts?: ReadonlyArray<SessionMountView> | null;
  readonly github?: Readonly<Record<string, MountGithubState>>;
  readonly bootstrapPhase?: Readonly<Record<string, BootstrapPhase>>;
};

const seed = ({
  projects = [PAYMENTS, LEDGER],
  mounts = [],
  github = {},
  bootstrapPhase = {},
}: SeedParams) => {
  useAppStore.setState({
    sessions: [session],
    projects,
    sessionMounts: mounts === null ? {} : { [SESSION_ID]: mounts },
    sessionProjectMounts:
      mounts === null
        ? {}
        : {
            [SESSION_ID]: mounts.map((mount) => ({
              mountId: mount.id,
              projectId: mount.projectId,
              mountName: mount.mountName,
              worktreePath: mount.worktreePath ?? mount.repoRoot,
              lastWorktreePath: mount.lastWorktreePath,
              repoRoot: mount.repoRoot,
              branch: mount.branch,
              baseBranch: mount.baseBranch,
              parallelIndex: mount.parallelIndex,
              diskState: mount.diskState,
              revision: mount.revision,
              sessionId: SESSION_ID,
              isAttached: mount.isAttached,
            })),
          },
    mountGithub: github,
    bootstrapPhase,
    detectedEditors: [{ binary: 'code', label: 'VS Code' }],
    loadSessionMounts: async () => mounts ?? [],
    loadPrSeries: async () => [],
    loadMountCleanupProposals: async () => [],
  });
};

const renderRows = () =>
  render(
    <ToastProvider>
      <ProjectMountRows session={session} />
    </ToastProvider>,
  );

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProjectMountRows', () => {
  it('gives each project its header and each worktree its row', async () => {
    seed({
      mounts: [
        mountView({ id: 'm1', branch: 'hl/fix-duplicate-credit' }),
        mountView({ id: 'm2', branch: 'hl/retry-state-copy' }),
        mountView({ id: 'm3', project: LEDGER, branch: 'hl/round-minor-units' }),
      ],
    });
    renderRows();

    screen.getByRole('list', { name: 'payments-api worktrees' });
    screen.getByRole('list', { name: 'ledger-core worktrees' });
    expect(screen.getAllByRole('button', { name: /^New worktree in/ })).toHaveLength(2);
    expect(
      screen.getAllByTestId('project-mount-row').map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'payments-api on hl/fix-duplicate-credit',
      'payments-api on hl/retry-state-copy',
      'ledger-core on hl/round-minor-units',
    ]);
  });

  it('puts the pull request of each worktree on its own row, and says when there is none', async () => {
    seed({
      mounts: [
        mountView({ id: 'm1', branch: 'hl/fix-duplicate-credit' }),
        mountView({ id: 'm2', branch: 'hl/retry-state-copy' }),
      ],
      github: { m1: githubOf('m1', 318, 'open') },
    });
    renderRows();

    const [first, second] = screen.getAllByTestId('project-mount-row');
    within(first as HTMLElement).getByText('PR #318');
    within(second as HTMLElement).getByText('No PR yet');
  });

  it('keeps merged worktrees under Completed, below the open ones', async () => {
    seed({
      mounts: [
        mountView({ id: 'm1', branch: 'hl/fix-webhook-idempotency' }),
        mountView({ id: 'm2', branch: 'hl/retry-state-copy' }),
      ],
      github: { m1: githubOf('m1', 311, 'merged') },
    });
    renderRows();

    await waitFor(() => expect(screen.getAllByTestId('project-mount-row')).toHaveLength(1));
    const completed = screen.getByRole('button', { name: /Completed/ });
    expect(completed.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(completed);

    expect(
      screen.getAllByTestId('project-mount-row').map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'payments-api on hl/retry-state-copy',
      'payments-api on hl/fix-webhook-idempotency',
    ]);
  });

  describe('a worktree on the base while its branch has an open pull request', () => {
    const onBase = {
      ...status.clean,
      branch: 'hl/cta-for-the-slot',
      head: 'aaaaaaa1',
      upstream: 'origin/hl/cta-for-the-slot',
      mainDistance: { kind: 'known', ahead: 0, behind: 0 },
    } satisfies WorktreeStatus;

    const original = status.clean;

    afterEach(() => {
      status.clean = original;
    });

    it('reads Merged when no pull request is linked and ancestry says so', async () => {
      status.clean = onBase;
      seed({ mounts: [mountView({ id: 'base-1', branch: 'hl/cta-for-the-slot' })] });
      renderRows();

      await screen.findByRole('button', { name: /Completed/ });
      expect(screen.queryAllByTestId('project-mount-row')).toHaveLength(0);
    });

    it('never moves under Completed and says it is not on the pull request commits', async () => {
      status.clean = onBase;
      seed({
        mounts: [mountView({ id: 'base-2', branch: 'hl/cta-for-the-slot' })],
        github: { 'base-2': githubOf('base-2', 9900, 'open', 'bbbbbbb2') },
      });
      renderRows();

      const row = await screen.findByTestId('project-mount-row');
      await within(row).findByText("Not on the PR's commits");
      expect(within(row).queryByText('Merged')).toBeNull();
      expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull();
    });

    it('reads as a normal row once the worktree is on the pull request head', async () => {
      status.clean = { ...onBase, head: 'bbbbbbb2' };
      seed({
        mounts: [mountView({ id: 'base-3', branch: 'hl/cta-for-the-slot' })],
        github: { 'base-3': githubOf('base-3', 9900, 'open', 'bbbbbbb2') },
      });
      renderRows();

      const row = await screen.findByTestId('project-mount-row');
      await within(row).findByText('PR #9900');
      await screen.findByText('Up to date');
      expect(within(row).queryByText("Not on the PR's commits")).toBeNull();
      expect(within(row).queryByText('Merged')).toBeNull();
      expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull();
    });
  });

  describe('a worktree stranded on the base while origin has the pull request commits', () => {
    const stranded = {
      ...status.clean,
      branch: 'hl/cta-for-the-slot',
      head: 'aaaaaaa1',
      upstream: 'origin/hl/cta-for-the-slot',
      upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
      mainDistance: { kind: 'known', ahead: 0, behind: 0 },
    } satisfies WorktreeStatus;
    const original = status.clean;
    const remoteState = {
      remoteAhead: 2,
      localOwn: 0,
      remoteContainsLocal: true,
      remoteSha: 'bbbbbbb2',
      localSha: 'aaaaaaa1',
    };

    afterEach(() => {
      status.clean = original;
    });

    it('offers one inline action to use the remote commits', async () => {
      status.clean = stranded;
      storySpies.remoteBranchState.mockResolvedValue(remoteState);
      seed({
        mounts: [mountView({ id: 'fix-1', branch: 'hl/cta-for-the-slot' })],
        github: { 'fix-1': githubOf('fix-1', 9900, 'open', 'bbbbbbb2') },
      });
      renderRows();

      await screen.findByText("This worktree is not on the PR's commits");
      screen.getByText('origin/hl/cta-for-the-slot has 2 commits this worktree does not have.');
      const action = screen.getByRole('button', { name: "Use the PR's commits" });
      expect((action as HTMLButtonElement).disabled).toBe(false);
      expect(storySpies.remoteBranchState).toHaveBeenCalledWith(
        expect.objectContaining({ repoPath: '/repo/payments-api', branch: 'hl/cta-for-the-slot' }),
      );
    });

    it('explains instead of acting while the worktree has local changes', async () => {
      status.clean = {
        ...stranded,
        workingTree: {
          kind: 'known',
          staged: 0,
          unstaged: 1,
          untracked: 0,
          unmerged: 0,
          changed: 1,
        },
      };
      storySpies.remoteBranchState.mockResolvedValue(remoteState);
      seed({
        mounts: [mountView({ id: 'fix-2', branch: 'hl/cta-for-the-slot' })],
        github: { 'fix-2': githubOf('fix-2', 9900, 'open', 'bbbbbbb2') },
      });
      renderRows();

      await screen.findByText(/Commit or discard the local changes first\./);
      const action = screen.getByRole('button', { name: "Use the PR's commits" });
      expect((action as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(action);
      expect(storySpies.moveToRemoteCommits).not.toHaveBeenCalled();
    });

    it('stays quiet when origin has no commits of its own on the branch', async () => {
      status.clean = stranded;
      storySpies.remoteBranchState.mockResolvedValue(null);
      seed({
        mounts: [mountView({ id: 'fix-3', branch: 'hl/cta-for-the-slot' })],
        github: { 'fix-3': githubOf('fix-3', 9900, 'open', 'bbbbbbb2') },
      });
      renderRows();

      await waitFor(() => expect(storySpies.remoteBranchState).toHaveBeenCalled());
      expect(screen.queryByText("This worktree is not on the PR's commits")).toBeNull();
    });

    it('never asks origin about a fresh worktree with no pull request', async () => {
      status.clean = {
        ...stranded,
        upstream: null,
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      };
      seed({ mounts: [mountView({ id: 'fix-4', branch: 'hl/cta-for-the-slot' })] });
      renderRows();

      await screen.findByTestId('project-mount-row');
      expect(storySpies.remoteBranchState).not.toHaveBeenCalled();
    });
  });

  it('folds each project into one summary line past four open worktrees', () => {
    seed({
      mounts: [
        mountView({ id: 'm1', branch: 'hl/one' }),
        mountView({ id: 'm2', branch: 'hl/two' }),
        mountView({ id: 'm3', branch: 'hl/three' }),
        mountView({ id: 'm4', project: LEDGER, branch: 'hl/four' }),
        mountView({ id: 'm5', project: LEDGER, branch: 'hl/five' }),
      ],
      github: { m1: githubOf('m1', 318, 'open'), m2: githubOf('m2', 322, 'open') },
    });
    renderRows();

    const summary = screen.getByRole('button', { name: /payments-api/ });
    within(summary).getByText('3 worktrees');
    within(summary).getByText('2 in review');
    expect(summary.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(summary);

    expect(summary.getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('listitem', { name: 'payments-api on hl/one' });
  });

  it('keeps four open worktrees as rows', () => {
    seed({
      mounts: [
        mountView({ id: 'm1', branch: 'hl/one' }),
        mountView({ id: 'm2', branch: 'hl/two' }),
        mountView({ id: 'm3', branch: 'hl/three' }),
        mountView({ id: 'm4', project: LEDGER, branch: 'hl/four' }),
      ],
    });
    renderRows();

    expect(screen.queryByText('3 worktrees')).toBeNull();
    expect(screen.getAllByTestId('project-mount-row')).toHaveLength(4);
  });

  it('says where turns run once it knows the session has no project, and stays quiet before', () => {
    seed({ mounts: null });
    const { unmount } = renderRows();
    expect(screen.queryByText(/No project yet/)).toBeNull();
    unmount();

    seed({ mounts: [] });
    renderRows();
    screen.getByText('No project yet. Turns run in the session folder until you add one.');
    screen.getByRole('button', { name: 'Add project' });
  });

  it('closes the explainer with its x for good', async () => {
    seed({ mounts: [mountView({ id: 'm1', branch: 'hl/one' })] });
    renderRows();

    screen.getByText('Where this session works. Each branch gets its own worktree.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });

    expect(useAppStore.getState().settings['projects.hint.dismissed']).toBe('true');
    expect(screen.queryByText(/Where this session works/)).toBeNull();
  });

  it('gives a first lap session the row of its project folder, not an empty section', () => {
    seed({
      projects: [PAYMENTS],
      mounts: [],
      bootstrapPhase: {
        [PAYMENTS.id]: {
          stage: 'first-lap',
          firstLapSessionId: SESSION_ID,
          bootstrapSessionId: null,
          snapshotId: null,
          worktreePath: null,
          branch: null,
          updatedAt: NOW,
        },
      },
    });
    renderRows();

    const folder = screen.getByRole('group', { name: 'payments-api project folder' });
    within(folder).getByText('Project folder');
    within(folder).getByText('not published');
    within(folder).getByRole('button', { name: 'Publish' });
    expect(screen.queryByText(/No project yet/)).toBeNull();
  });

  it('never offers the first lap project in Add project, and moves the action to the overflow', () => {
    seed({
      projects: [PAYMENTS],
      mounts: [],
      bootstrapPhase: {
        [PAYMENTS.id]: {
          stage: 'first-lap',
          firstLapSessionId: SESSION_ID,
          bootstrapSessionId: null,
          snapshotId: null,
          worktreePath: null,
          branch: null,
          updatedAt: NOW,
        },
      },
    });
    renderRows();

    expect(screen.queryByRole('button', { name: 'Add project' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Project actions' }));
    screen.getByRole('menuitem', { name: /Add project/ });
    expect(screen.queryByRole('button', { name: 'Add payments-api' })).toBeNull();
  });

  it('keeps Add project in the header while a workspace project is left to add', () => {
    seed({ mounts: [mountView({ id: 'm1', branch: 'hl/one' })] });
    renderRows();

    screen.getByRole('button', { name: 'Add project' });
    expect(screen.queryByRole('button', { name: 'Project actions' })).toBeNull();
  });

  it('draws skeleton rows on the loaded grid while the mounts load, never a header alone', () => {
    seed({ mounts: null });
    const { unmount } = renderRows();

    const skeleton = screen.getByTestId('mount-skeleton');
    expect(within(skeleton).getAllByTestId('mount-skeleton-row')).toHaveLength(2);
    expect(skeleton.querySelector('[data-mount-grid]')?.getAttribute('data-mount-grid')).toBe(
      mountGridTracksOf().join(' '),
    );
    unmount();

    seed({ mounts: [mountView({ id: 'm1', branch: 'hl/one' })] });
    renderRows();
    expect(screen.queryByTestId('mount-skeleton')).toBeNull();
    screen.getByTestId('project-mount-row');
  });

  it('turns only the refreshing parts of a row to skeleton, after 250 ms', () => {
    vi.useFakeTimers();
    seed({
      mounts: [mountView({ id: 'm1', branch: 'hl/fix-duplicate-credit' })],
      github: { m1: githubOf('m1', 318, 'open') },
    });
    renderRows();
    screen.getByText('PR #318');

    act(() => {
      useAppStore.setState({ sessionSyncing: { [SESSION_ID]: true } });
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText('PR #318')).toBeNull();
    screen.getByRole('listitem', { name: 'payments-api on hl/fix-duplicate-credit' });
    screen.getByRole('list', { name: 'payments-api worktrees' });
  });
});
