// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    updateProjectIdentity: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../worktree/worktree', async () =>
  (await import('../../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../integrations/github/github', () => ({ tauriGhRunner: {} }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type FirstCommit,
  type FirstCommitPlan,
  type Project,
  type ProjectId,
  type WorkspaceGitStatus,
} from '@goodboy/types';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { BlockedBoard } from '.';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Acme web' });
const WEB_PATH = '/work/acme/acme-web';

const WEB: Project = aProject({
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  workspaceId: WORKSPACE.id,
  name: 'acme-web',
  kind: 'repo',
  rootPath: WEB_PATH,
});

const statusOf = (state: WorkspaceGitStatus['state']): WorkspaceGitStatus => ({
  state,
  branch: 'main',
  headSubject: state === 'ready' ? 'Start acme-web' : null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
});

const PLAN: FirstCommitPlan = {
  rootPath: WEB_PATH,
  start: 'no_commits',
  branch: 'main',
  author: { name: 'Dana Reyes', email: 'dana@acme.dev', isFallback: false },
  hasIgnoreFile: false,
  entries: [
    {
      key: 'src/',
      kind: 'included',
      files: 40,
      sample: ['src/index.ts'],
      isLeftOut: false,
      canToggle: false,
      ignore: null,
    },
  ],
};

const FIRST_COMMIT: FirstCommit = {
  rootPath: WEB_PATH,
  branch: 'main',
  commit: 'a1b2c3d',
  files: 40,
};

const invoked = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const renderBoard = () =>
  render(
    <BlockedBoard
      entries={[{ project: WEB, status: statusOf('unborn') }]}
      title="This folder needs a git repository with one commit first"
      description="Sessions branch from the latest commit, and this repository has none yet."
    />,
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    projects: [WEB],
    projectGitStatus: { [WEB.id]: statusOf('unborn') },
  });
});

afterEach(cleanup);

describe('BlockedBoard for a repository with no commit', () => {
  it('makes the first commit in place and reads the repository again', async () => {
    stubStoryInvoke({
      folder_git_first_commit_plan: () => PLAN,
      folder_git_make_first_commit: () => FIRST_COMMIT,
      project_git_status: () => statusOf('ready'),
      repo_identity: () => ({ rootCommits: ['a1b2c3d'], remoteUrl: null }),
    });
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Make the first commit' }));
    const flow = await screen.findByRole('region', { name: 'First commit in acme-web' });
    await within(flow).findByText('40 files in the first commit');
    fireEvent.click(within(flow).getByRole('button', { name: 'Make the first commit' }));

    await waitFor(() =>
      expect(useAppStore.getState().projectGitStatus[WEB.id]?.state).toBe('ready'),
    );
    expect(invoked('folder_git_make_first_commit')).toEqual([
      { args: { path: WEB_PATH, include: [] } },
    ]);
    expect(useAppStore.getState().projects[0]?.kind).toBe('repo');
  });

  it('shows the reason and keeps the review open when the commit fails', async () => {
    stubStoryInvoke({
      folder_git_first_commit_plan: () => PLAN,
      folder_git_make_first_commit: () => {
        throw new Error('git failed: index.lock exists');
      },
    });
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Make the first commit' }));
    const flow = await screen.findByRole('region', { name: 'First commit in acme-web' });
    await within(flow).findByText('40 files in the first commit');
    fireEvent.click(within(flow).getByRole('button', { name: 'Make the first commit' }));

    await within(flow).findByText(/index\.lock exists/);
    expect(useAppStore.getState().projectGitStatus[WEB.id]?.state).toBe('unborn');
    expect(within(flow).getByRole('button', { name: 'Make the first commit' }));
  });

  it('goes back to the one action when the review is cancelled', async () => {
    stubStoryInvoke({ folder_git_first_commit_plan: () => PLAN });
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Make the first commit' }));
    const flow = await screen.findByRole('region', { name: 'First commit in acme-web' });
    await within(flow).findByText('40 files in the first commit');
    fireEvent.click(within(flow).getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Make the first commit' }));
    expect(screen.queryByRole('region', { name: 'First commit in acme-web' })).toBeNull();
  });
});
