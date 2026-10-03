// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/api/path', () => ({ homeDir: async () => '/Users/dana/' }));

const picked = vi.hoisted(() => ({ folder: null as string | null }));

vi.mock('../../lib/pickFolder', () => ({ pickFolder: async () => picked.folder }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, Session, Workspace, WorkspaceId } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { CommandError } from '../../lib/invokeCommand';
import { NewProjectForm } from './index';

const workspace = aWorkspace({ name: 'cascadia' });
const project = aProject({ workspaceId: workspace.id, name: 'cascadia' });
const lapSession = aSession({ workspaceId: workspace.id });

type Calls = {
  created: Array<{ readonly parentPath: string; readonly name: string }>;
  added: Array<{ readonly rootPath: string }>;
  opened: Array<{ readonly id: WorkspaceId; readonly title?: string; readonly onRunning?: string }>;
  firstLaps: Array<{ readonly projectId: Project['id'] }>;
};

let useAppStore: StoryStore;
let calls: Calls;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const wireActions = ({
  createFails,
  firstLapFails,
}: {
  readonly createFails?: Error;
  readonly firstLapFails?: Error;
} = {}) => {
  useAppStore.setState({
    sessions: [lapSession],
    createNewProject: async (input) => {
      calls.created.push(input);
      if (createFails !== undefined) {
        throw createFails;
      }
      return { workspace, project };
    },
    addWorkspace: async (input): Promise<Workspace> => {
      calls.added.push(input);
      return workspace;
    },
    openWorkspace: async (input) => {
      calls.opened.push(input);
      return { kind: 'opened' };
    },
    ensureFirstLapSession: async (input): Promise<Session> => {
      calls.firstLaps.push(input);
      if (firstLapFails !== undefined) {
        throw firstLapFails;
      }
      return lapSession;
    },
  });
};

beforeEach(async () => {
  await resetStoryStore();
  picked.folder = null;
  calls = { created: [], added: [], opened: [], firstLaps: [] };
  wireActions();
});

afterEach(cleanup);

const typeName = (value: string) =>
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value } });

describe('NewProjectForm', () => {
  it('keeps Create project disabled until the name is usable and says what is wrong', async () => {
    render(<NewProjectForm />);
    const create = screen.getByRole('button', { name: 'Create project' });
    await screen.findByText('/Users/dana/your-project');
    expect(create).toHaveProperty('disabled', true);

    typeName('my game');
    screen.getByText('Use letters, numbers, dashes, dots and underscores');
    expect(create).toHaveProperty('disabled', true);

    typeName('cascadia');
    expect(screen.queryByText(/Use letters/)).toBeNull();
    await screen.findByText('/Users/dana/cascadia');
    expect(create).toHaveProperty('disabled', false);
  });

  it('lists the four things the click does', () => {
    render(<NewProjectForm />);

    screen.getByText('Creates the project folder');
    screen.getByText('Starts a git repository on main');
    screen.getByText('Makes a first commit with a .gitignore and nothing else');
    screen.getByText('Opens a first session that works in that folder');
  });

  it('creates the project, remembers the location, opens it and starts the first lap', async () => {
    const onCreated = vi.fn();
    render(<NewProjectForm onCreated={onCreated} />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(lapSession.id));
    expect(calls.created).toEqual([{ parentPath: '/Users/dana', name: 'cascadia' }]);
    expect(useAppStore.getState().settings['new-project.parent']).toBe('/Users/dana');
    expect(calls.opened).toEqual([
      { id: workspace.id, title: 'cascadia', onRunning: 'new-window' },
    ]);
    expect(calls.firstLaps).toEqual([{ projectId: project.id }]);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('uses the folder the person picked as the location', async () => {
    picked.folder = '/Volumes/work/games';
    render(<NewProjectForm />);
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    await screen.findByText('/Volumes/work/games/cascadia');
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(calls.created).toEqual([{ parentPath: '/Volumes/work/games', name: 'cascadia' }]),
    );
  });

  it('says when the folder exists and offers to open it instead', async () => {
    wireActions({
      createFails: new CommandError({
        kind: 'already_exists',
        message: '/Users/dana/cascadia already exists',
      }),
    });
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await screen.findByText('A folder named cascadia already exists here');
    fireEvent.click(screen.getByRole('button', { name: 'Open it instead' }));

    await waitFor(() => expect(calls.added).toEqual([{ rootPath: '/Users/dana/cascadia' }]));
    expect(calls.opened).toHaveLength(1);
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('keeps the project and says what is missing when the first session cannot start', async () => {
    wireActions({ firstLapFails: new Error('Connect an agent first') });
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await screen.findByText('The project is ready. Connect an agent first');
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('shows a Rust refusal without opening anything', async () => {
    wireActions({
      createFails: new CommandError({
        kind: 'nested_repo',
        message: 'this folder is already inside a repository',
      }),
    });
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await screen.findByText('this folder is already inside a repository');
    expect(calls.opened).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Open it instead' })).toBeNull();
  });
});
