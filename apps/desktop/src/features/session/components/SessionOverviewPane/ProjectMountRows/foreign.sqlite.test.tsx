// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
const status = vi.hoisted(() => ({
  current: null as unknown,
}));
vi.mock('../../../../worktree/worktree', async () => ({
  ...(await import('../../../../../store/storyHarness')).worktreeModuleMock(),
  worktreeStatus: async () => status.current,
}));
vi.mock('../../../../integrations/github/github', async () => ({
  ...(await import('../../../../../store/storyHarness')).githubModuleMock(),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  insertProject,
  insertSession,
  insertSessionMount,
  insertWorkspace,
  listSessionMounts,
} from '@goodboy/db';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { BranchSwitchPanel } from '../../../../worktree/BranchSwitchPanel';
import { NewBranchMountAction } from './NewBranchMountAction';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';

const NOW = '2026-10-06T09:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
const SESSION_ID = 'session-review-9900' as SessionId;
const MOUNT_ID = 'mount-review' as MountId;
const TEAMMATE = 'grw-1348-cta-for-the-slot';
const WORKTREE = '/repo/ledger-core/.goodboy/worktrees/review';

let useAppStore: StoryStore;
let ProjectMountRows: typeof import('.').ProjectMountRows;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ ProjectMountRows } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

const onBase = {
  branch: TEAMMATE,
  head: 'aaaaaaa1',
  headSubject: 'base',
  upstream: `origin/${TEAMMATE}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
} satisfies WorktreeStatus;

const openPr: PullRequestState = {
  number: 9900,
  title: 'Skip the slot step',
  url: 'https://example.invalid/pull/9900',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: TEAMMATE,
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: NOW,
  headSha: 'bbbbbbb2',
};

const storedMount = async () => {
  const db = (await import('../../../../../test/sqliteDb')).storySqlite();
  return (await listSessionMounts({ db, sessionId: SESSION_ID }))[0];
};

beforeEach(async () => {
  await resetStoryStore();
  status.current = onBase;
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' });
  const project = buildStoryProject({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    kind: 'repo',
    rootPath: '/repo/ledger-core',
  });
  const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  await insertSession(db, session);
  await insertSessionMount({
    db,
    mount: {
      id: MOUNT_ID,
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
      worktreePath: WORKTREE,
      lastWorktreePath: WORKTREE,
      branch: TEAMMATE,
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: 'harborline/ledger-core',
      isAttached: true,
      diskState: 'present',
      revision: 0,
      branchOrigin: 'created',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  stubStoryInvoke({ detect_editors: () => [] });
  useAppStore.setState({
    sessions: [session],
    projects: [project],
    workspaces: [workspace],
    detectedEditors: [],
    loadPrSeries: async () => [],
    loadMountCleanupProposals: async () => [],
  });
  await useAppStore.getState().loadSessionMounts({ sessionId: SESSION_ID });
});

afterEach(cleanup);

describe('a teammate pull request opened from Goodboy', () => {
  it('moves the stranded worktree onto the pull request commits and records it as adopted', async () => {
    storySpies.remoteBranchState.mockResolvedValue({
      remoteAhead: 2,
      localOwn: 0,
      remoteContainsLocal: true,
      remoteSha: 'bbbbbbb2',
      localSha: 'aaaaaaa1',
    });
    useAppStore.setState({
      mountGithub: {
        [MOUNT_ID]: {
          pr: openPr,
          prs: [openPr],
          links: [],
          linkedIssues: [],
          fetchedAt: NOW,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
          mountId: MOUNT_ID,
          projectId: PROJECT_ID,
          revision: 0,
          repository: 'harborline/ledger-core',
          host: 'github.com',
          branch: TEAMMATE,
        },
      },
    });
    const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
    render(
      <ToastProvider>
        <ProjectMountRows session={session} />
      </ToastProvider>,
    );

    const row = await screen.findByTestId('project-mount-row');
    await within(row).findByText("Not on the PR's commits");
    expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull();
    expect((await storedMount())?.branchOrigin).toBe('created');

    fireEvent.click(await screen.findByRole('button', { name: "Use the PR's commits" }));

    await waitFor(() =>
      expect(storySpies.moveToRemoteCommits).toHaveBeenCalledWith({
        worktreePath: WORKTREE,
        branch: TEAMMATE,
      }),
    );
    await waitFor(async () => expect((await storedMount())?.branchOrigin).toBe('adopted'));
    const stored = await storedMount();
    expect(stored?.branch).toBe(TEAMMATE);
    expect(stored?.revision).toBe(1);
  });

  it('is continued in a new worktree picked from the list, by its own name', async () => {
    storySpies.ghOpenPrBranches.mockResolvedValue([
      {
        number: 9900,
        title: 'Skip the slot step',
        headBranch: 'grw-1348-cta',
        isDraft: false,
        author: 'pat-harborline',
      },
    ]);
    storySpies.createWorktree.mockImplementation(async (args: unknown) => {
      const { dirName, existingBranch } = args as { dirName: string; existingBranch: string };
      return {
        worktreePath: `/repo/ledger-core/.goodboy/worktrees/${dirName}`,
        branchName: existingBranch,
        slug: dirName,
        reused: false,
      };
    });
    render(
      <ToastProvider>
        <NewBranchMountAction
          sessionId={SESSION_ID}
          projectId={PROJECT_ID}
          projectName="ledger-core"
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New branch in ledger-core' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Existing branch' }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Branch' }));
    const option = await screen.findByRole('option', { name: /grw-1348-cta/ });
    expect(option.textContent).toContain('PR #9900 · pat-harborline');
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    await waitFor(() =>
      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ existingBranch: 'grw-1348-cta', branchName: 'grw-1348-cta' }),
      ),
    );
    const db = (await import('../../../../../test/sqliteDb')).storySqlite();
    await waitFor(async () =>
      expect(await listSessionMounts({ db, sessionId: SESSION_ID })).toHaveLength(2),
    );
    const mounts = await listSessionMounts({ db, sessionId: SESSION_ID });
    expect(mounts.map((mount) => [mount.branch, mount.branchOrigin])).toContainEqual([
      'grw-1348-cta',
      'adopted',
    ]);
  });

  it('is picked from the branch list, continued with its commits and recorded as adopted', async () => {
    storySpies.ghOpenPrBranches.mockResolvedValue([
      {
        number: 9900,
        title: 'Skip the slot step',
        headBranch: TEAMMATE,
        isDraft: false,
        author: 'pat-harborline',
      },
    ]);
    storySpies.listRemoteBranches.mockResolvedValue([
      { name: TEAMMATE, author: 'Pat Harborline', sha: 'bbbbbbb2', timestamp: 1, hasLocal: false },
      {
        name: 'old-experiment',
        author: 'Sam Northwind',
        sha: 'ccccccc3',
        timestamp: 0,
        hasLocal: false,
      },
    ]);
    storySpies.changeWorktreeBranch.mockResolvedValueOnce({ adopted: false });
    await useAppStore.getState().switchMount({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      branch: 'hl/own-work',
      createNew: true,
    });
    expect((await storedMount())?.branch).toBe('hl/own-work');
    expect((await storedMount())?.branchOrigin).toBe('created');
    storySpies.changeWorktreeBranch.mockClear();
    storySpies.changeWorktreeBranch.mockResolvedValue({ adopted: true });

    render(
      <ToastProvider>
        <BranchSwitchPanel sessionId={SESSION_ID} mountId={MOUNT_ID} onDone={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /pick existing/i }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Branch' }));
    const option = await screen.findByRole('option', { name: new RegExp(TEAMMATE) });
    expect(option.textContent).toContain('PR #9900 · pat-harborline');
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    await waitFor(() =>
      expect(storySpies.changeWorktreeBranch).toHaveBeenCalledWith(
        expect.objectContaining({ branch: TEAMMATE, createNew: false }),
      ),
    );
    await waitFor(async () => expect((await storedMount())?.branch).toBe(TEAMMATE));
    expect((await storedMount())?.branchOrigin).toBe('adopted');
  });
});
