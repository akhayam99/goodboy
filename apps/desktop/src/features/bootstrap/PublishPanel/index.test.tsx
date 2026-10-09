// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import type { LinkedRemote, PublishOutcome, RemoteProbe } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { PublishFirstLapResult } from '../../../store/slices/bootstrap/publishFirstLap';
import { PublishPanel } from './index';

const workspace = aWorkspace({ name: 'Cascadia', slug: 'cascadia' });
const project = aProject({
  workspaceId: workspace.id,
  name: 'cascadia',
  kind: 'repo',
  rootPath: '/games/cascadia',
});
const REPO_URL = 'https://github.com/dana-reyes/cascadia';

const connected = {
  available: true,
  mode: 'gh-cli',
  user: 'dana-reyes',
  scopes: [],
  scoped: false,
} as const;

const PUBLISHED: PublishOutcome = { kind: 'published', branch: 'main', sha: 'abc1234' };

type Wire = {
  readonly ghRuns: Array<ReadonlyArray<string>>;
  readonly linked: string[];
  publishOutcomes: PublishOutcome[];
};

let useAppStore: StoryStore;
let wire: Wire;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  wire = {
    ghRuns: [],
    linked: [],
    publishOutcomes: [PUBLISHED],
  };
  stubStoryInvoke({
    gh_run: ({ args }: { readonly args: ReadonlyArray<string> }) => {
      wire.ghRuns.push(args);
      const isPrivate = wire.ghRuns.some((run) => run.includes('--private'));
      return args[1] === 'create'
        ? { stdout: `${REPO_URL}\n`, stderr: '', exitCode: 0 }
        : {
            stdout: JSON.stringify({
              nameWithOwner: 'dana-reyes/cascadia',
              url: REPO_URL,
              sshUrl: 'git@github.com:dana-reyes/cascadia.git',
              isPrivate,
            }),
            stderr: '',
            exitCode: 0,
          };
    },
    project_link_remote: ({ remoteUrl }: { readonly remoteUrl: string }): LinkedRemote => {
      wire.linked.push(remoteUrl);
      return { remoteUrl, added: true };
    },
    project_publish_main: (): PublishOutcome =>
      (wire.publishOutcomes.length > 1 ? wire.publishOutcomes.shift() : wire.publishOutcomes[0]) ??
      PUBLISHED,
    project_remote_probe: (): RemoteProbe => ({ kind: 'main-present', branch: 'main', sha: 'abc' }),
    project_git_status: {
      state: 'missing',
      branch: null,
      headSubject: null,
      upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
      workingTree: { kind: 'unknown', reason: 'status-read-failed' },
      upstream: null,
      inProgress: null,
    },
  });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    githubStatus: connected,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPanel = (props: { primaryLabel?: string } = {}) => {
  const published: PublishFirstLapResult[] = [];
  const onCancel = vi.fn();
  render(
    <PublishPanel
      project={project}
      onPublished={(result) => published.push(result)}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { published, onCancel };
};

const storedRemote = async () => {
  const rows = await rowsOf<{ remote_url: string | null }>({
    sql: 'SELECT remote_url FROM projects WHERE id = ?',
    params: [project.id],
  });
  expect(useAppStore.getState().projects.find((p) => p.id === project.id)?.remoteUrl).toBe(
    rows[0]?.remote_url,
  );
  return rows[0]?.remote_url;
};

describe('PublishPanel on GitHub', () => {
  it('needs an explicit visibility before it can publish, then creates the repository and links it', async () => {
    const { published } = renderPanel();
    screen.getByText('Connected as dana-reyes');
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    screen.getByRole('button', { name: 'Cancel' });
    screen.getByText('Pick who can see the repository. Goodboy does not choose for you.');

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toHaveProperty('disabled', false);
    fireEvent.click(publish);

    await waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]).toEqual({ kind: 'published', branch: 'main', remoteUrl: REPO_URL });
    expect(wire.ghRuns[0]).toEqual(['repo', 'create', 'cascadia', '--private']);
    expect(await storedRemote()).toBe(REPO_URL);
  });

  it('creates a public repository when public is picked', async () => {
    const { published } = renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(published).toHaveLength(1));
    expect(wire.ghRuns[0]).toEqual(['repo', 'create', 'cascadia', '--public']);
  });

  it('shows a name problem and takes the button away until the name is valid', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));

    fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'my game' } });

    screen.getByRole('alert');
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'my-game' } });
    screen.getByRole('button', { name: 'Publish' });
  });

  it('shows the visible heading Publish this project over the form', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Publish this project' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Publish this project' })).toBeDefined();
  });

  it('says when GitHub is not signed in and offers the connect form', () => {
    useAppStore.setState({
      githubStatus: { available: true, mode: 'absent', scopes: [], scoped: false },
    });
    renderPanel();

    screen.getByText('Connect GitHub to create a repository.');
    screen.getByLabelText('Personal API key');
    expect(screen.queryByLabelText('Repository name')).toBeNull();
  });

  it('starts on the existing repository when the command line tool is missing', () => {
    useAppStore.setState({
      githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
    });
    renderPanel();

    expect(
      screen.getByRole('tab', { name: 'Use an existing repository' }).getAttribute('aria-selected'),
    ).toBe('true');
    screen.getByLabelText('Repository address');
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    screen.getByRole('button', { name: 'Cancel' });
  });

  it('starts on GitHub when the command line tool is there', () => {
    renderPanel();

    expect(
      screen.getByRole('tab', { name: 'Create on GitHub' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
});

describe('PublishPanel without the GitHub command line tool', () => {
  const missing = () =>
    useAppStore.setState({
      githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
    });

  const pickGithub = () => fireEvent.click(screen.getByRole('tab', { name: 'Create on GitHub' }));

  it('shows the install command with Copy on macOS and puts it on the clipboard', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Mac OS X)');
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    missing();
    renderPanel();
    pickGithub();

    const notice = screen.getByText("GitHub's command line tool isn't installed");
    expect(notice).toBeDefined();
    screen.getByText('brew install gh');
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith('brew install gh'));
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    screen.getByRole('button', { name: 'Cancel' });
  });

  it('links the install page on the other platforms', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64)');
    missing();
    renderPanel();
    pickGithub();

    expect(screen.queryByText('brew install gh')).toBeNull();
    expect(screen.getByRole('link', { name: /Install gh/ }).getAttribute('href')).toBe(
      'https://cli.github.com',
    );
  });

  it('checks again once and shows the signed-in form when the tool is there', async () => {
    const statusReads: number[] = [];
    stubStoryInvoke({
      gh_status: () => {
        statusReads.push(1);
        return connected;
      },
    });
    missing();
    renderPanel();
    pickGithub();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await screen.findByText('Connected as dana-reyes');
    expect(statusReads).toHaveLength(1);
    screen.getByLabelText('Repository name');
    expect(screen.queryByText("GitHub's command line tool isn't installed")).toBeNull();
  });

  it('stays on the help when the tool is still missing after checking again', async () => {
    stubStoryInvoke({
      gh_status: { available: false, mode: 'absent', scopes: [], scoped: false },
    });
    missing();
    renderPanel();
    pickGithub();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check again' })).toHaveProperty('disabled', false),
    );
    screen.getByText("GitHub's command line tool isn't installed");
  });
});

describe('PublishPanel status loading', () => {
  it('reads the status when it is not known yet', async () => {
    stubStoryInvoke({
      gh_status: { ...connected, user: 'mara-quint' },
    });
    useAppStore.setState({ githubStatus: null });
    renderPanel();

    await screen.findByText('Connected as mara-quint');
    expect(useAppStore.getState().githubStatus?.user).toBe('mara-quint');
  });

  it('labels the primary action when the work will move too', () => {
    renderPanel({ primaryLabel: 'Publish and move my work' });
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));

    screen.getByRole('button', { name: 'Publish and move my work' });
  });
});

describe('PublishPanel with an address', () => {
  const openAddress = () => {
    const rendered = renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Use an existing repository' }));
    return rendered;
  };

  it('publishes to the trimmed address', async () => {
    const { published } = openAddress();
    fireEvent.change(screen.getByLabelText('Repository address'), {
      target: { value: ' git@gitlab.example.com:dana/cascadia.git ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(published).toHaveLength(1));
    expect(wire.linked).toEqual(['git@gitlab.example.com:dana/cascadia.git']);
    expect(await storedRemote()).toBe('git@gitlab.example.com:dana/cascadia.git');
    expect(wire.ghRuns).toEqual([]);
  });

  it('names the failed step, keeps the repository address and publishes again from it', async () => {
    wire.publishOutcomes = [
      { kind: 'failed', step: 'push', message: 'remote: Permission denied' },
      { kind: 'published', branch: 'main', sha: 'abc1234' },
    ];
    const { published } = renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await screen.findByText('Publishing main failed');
    screen.getByText(
      /The repository exists at https:\/\/github.com\/dana-reyes\/cascadia and was not removed/,
    );
    expect(screen.queryByText('remote: Permission denied')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    screen.getByText('remote: Permission denied');
    expect(published).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]).toEqual({ kind: 'published', branch: 'main', remoteUrl: REPO_URL });
    expect(wire.linked).toEqual([REPO_URL, REPO_URL]);
    expect(wire.ghRuns.filter((args) => args[1] === 'create')).toHaveLength(1);
  });

  it('says nothing was pushed when the remote already has main', async () => {
    wire.publishOutcomes = [{ kind: 'remote-has-main', branch: 'main' }];
    const { published } = openAddress();
    fireEvent.change(screen.getByLabelText('Repository address'), {
      target: { value: REPO_URL },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await screen.findByText('That repository already has main');
    expect(published).toEqual([{ kind: 'remote-has-main', branch: 'main', remoteUrl: REPO_URL }]);
  });
});
