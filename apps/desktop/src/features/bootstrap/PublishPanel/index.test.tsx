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

afterEach(cleanup);

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
    const publish = screen.getByRole('button', { name: 'Publish' });
    screen.getByText('Connected as dana-reyes');
    expect(publish).toHaveProperty('disabled', true);
    screen.getByText('Pick who can see the repository. Goodboy does not choose for you.');

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
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

  it('shows a name problem and blocks the button', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));

    fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'my game' } });

    screen.getByRole('alert');
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true);
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

  it('says when the command line tool is missing and still lets an address through', () => {
    useAppStore.setState({
      githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
    });
    renderPanel();

    screen.getByText(/command line tool isn't installed/);
    fireEvent.click(screen.getByRole('tab', { name: 'Use an existing repository' }));
    screen.getByLabelText('Repository address');
  });

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
    expect(published).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Publish again' }));
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
