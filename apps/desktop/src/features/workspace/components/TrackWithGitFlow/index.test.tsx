// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    updateProjectKind: vi.fn(async () => undefined),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => undefined),
    deleteSetting: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../integrations/github/github', () => ({ tauriGhRunner: {} }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type FirstCommitPlan,
  type FolderGitProbe,
  type Project,
  type ProjectId,
} from '@goodboy/types';
import { aProject, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { FolderGitCard } from './FolderGitCard';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Acme web' });
const WEB_PATH = '/work/acme/acme-web';

const WEB: Project = aProject({
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  workspaceId: WORKSPACE.id,
  name: 'acme-web',
  kind: 'folder',
  rootPath: WEB_PATH,
});

type EntryParams = {
  readonly key: string;
  readonly kind: FirstCommitPlan['entries'][number]['kind'];
  readonly files: number;
  readonly sample?: ReadonlyArray<string>;
};

const entry = ({ key, kind, files, sample = [key] }: EntryParams) => ({
  key,
  kind,
  files,
  sample,
  isLeftOut: kind !== 'included',
  canToggle: kind === 'dependencies' || kind === 'output',
  ignore: kind === 'included' ? null : `/${key}`,
});

const PLAN: FirstCommitPlan = {
  rootPath: WEB_PATH,
  start: 'no_git',
  branch: 'main',
  author: { name: 'Dana Reyes', email: 'dana@acme.dev', isFallback: false },
  hasIgnoreFile: false,
  entries: [
    entry({ key: 'src/', kind: 'included', files: 196 }),
    entry({ key: 'public/', kind: 'included', files: 12 }),
    entry({
      key: '.',
      kind: 'included',
      files: 6,
      sample: ['README.md', 'package.json', 'tsconfig.json'],
    }),
    entry({ key: 'node_modules/', kind: 'dependencies', files: 1204 }),
    entry({ key: 'dist/', kind: 'output', files: 38 }),
    entry({ key: '.env*', kind: 'secret', files: 1, sample: ['.env'] }),
  ],
};

type ProbeParams = {
  readonly state: FolderGitProbe['state'];
  readonly remoteUrl?: string | null;
};

const probeOf = ({ state, remoteUrl = null }: ProbeParams): FolderGitProbe => ({
  path: WEB_PATH,
  state,
  rootPath: state === 'none' ? null : WEB_PATH,
  branch: state === 'none' ? null : 'main',
  commitCount: state === 'tracked' ? 1 : 0,
  remoteUrl,
});

const invoked = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const renderCard = () => render(<FolderGitCard projectId={WEB.id} isInitiallyOpen={false} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    projects: [WEB],
    folderPurpose: { [WEB.id]: 'code' },
    folderGit: { [WEB.id]: probeOf({ state: 'none' }) },
  });
});

afterEach(cleanup);

describe('Track with git', () => {
  it('reviews the first commit in place, with secrets always left out', async () => {
    stubStoryInvoke({ folder_git_first_commit_plan: () => PLAN });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Track with git' }));

    const flow = await screen.findByRole('region', { name: 'Track acme-web with git' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await within(flow).findByText('214 files in the first commit');
    expect(
      within(flow).getByText(/as Dana Reyes <dana@acme\.dev> from your git settings/),
    ).toBeDefined();
    expect(within(flow).queryByRole('checkbox', { name: 'Commit .env' })).toBeNull();
    expect(within(flow).queryByRole('checkbox', { name: 'Commit src/' })).toBeNull();
    expect(within(flow).getByText('looks like secrets, always left out')).toBeDefined();

    fireEvent.click(within(flow).getByRole('checkbox', { name: 'Commit node_modules/' }));

    expect(within(flow).getByText('1,418 files in the first commit')).toBeDefined();
  });

  it('makes the first commit with what was ticked and says the folder is tracked', async () => {
    const probes = [probeOf({ state: 'tracked' })];
    stubStoryInvoke({
      folder_git_first_commit_plan: () => PLAN,
      folder_git_make_first_commit: () => ({
        rootPath: WEB_PATH,
        branch: 'main',
        commit: 'a1b2c3d',
        files: 1419,
      }),
      validate_git_repo: () => ({ isRepo: true, rootPath: WEB_PATH, defaultBranch: 'main' }),
      folder_git_probe: () => probes[0],
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Track with git' }));
    const flow = await screen.findByRole('region', { name: 'Track acme-web with git' });
    await within(flow).findByText('214 files in the first commit');
    fireEvent.click(within(flow).getByRole('checkbox', { name: 'Commit node_modules/' }));

    fireEvent.click(within(flow).getByRole('button', { name: 'Make the first commit' }));

    await screen.findByText('acme-web is tracked with git.');
    expect(invoked('folder_git_make_first_commit')).toEqual([
      { args: { path: WEB_PATH, include: ['node_modules/'] } },
    ]);
    expect(useAppStore.getState().projects[0]?.kind).toBe('repo');
    expect(screen.getByRole('button', { name: 'Publish to GitHub' })).toBeDefined();
    expect(
      screen.getByText('1 commit, on this Mac only. New sessions get their own branch from main.'),
    ).toBeDefined();
  });

  it("shows git's message when the first commit fails and keeps the folder plain", async () => {
    stubStoryInvoke({
      folder_git_first_commit_plan: () => PLAN,
      folder_git_make_first_commit: () => {
        throw new Error('git failed: unable to index file src/locked.ts');
      },
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Track with git' }));
    const flow = await screen.findByRole('region', { name: 'Track acme-web with git' });
    await within(flow).findByText('214 files in the first commit');

    fireEvent.click(within(flow).getByRole('button', { name: 'Make the first commit' }));

    expect((await within(flow).findByRole('alert')).textContent).toContain(
      'unable to index file src/locked.ts',
    );
    expect(useAppStore.getState().projects[0]?.kind).toBe('folder');
    expect(within(flow).getByRole('button', { name: 'Make the first commit' })).toBeDefined();
  });

  it('offers the first commit for an empty repository', () => {
    useAppStore.setState({ folderGit: { [WEB.id]: probeOf({ state: 'empty' }) } });
    renderCard();

    expect(screen.getByText('No commits yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make the first commit' })).toBeDefined();
  });

  it('opens the publish form in place for a folder tracked on this Mac only', async () => {
    const repo: Project = { ...WEB, kind: 'repo' };
    useAppStore.setState({
      projects: [repo],
      folderGit: { [WEB.id]: probeOf({ state: 'tracked' }) },
      githubStatus: { mode: 'gh-cli', available: true, user: 'dana-reyes', scopes: [] },
    });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Publish to GitHub' }));

    expect(await screen.findByRole('region', { name: 'Publish this folder' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says git was found outside and keeps editing in place when asked', async () => {
    const repo: Project = { ...WEB, kind: 'repo' };
    useAppStore.setState({
      projects: [repo],
      folderGit: { [WEB.id]: { ...probeOf({ state: 'tracked' }), commitCount: 3 } },
      folderGitNotice: {
        [WEB.id]: {
          kind: 'switched',
          foundAt: TEST_NOW,
          commitCount: 3,
          branch: 'main',
        },
      },
    });
    renderCard();

    expect(screen.getByText('acme-web is now a git repository.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing in place' }));

    await waitFor(() => expect(useAppStore.getState().projects[0]?.kind).toBe('folder'));
    expect(useAppStore.getState().folderGitChoice[WEB.id]).toBe('in-place');
    expect(screen.queryByText('acme-web is now a git repository.')).toBeNull();
  });
});
