// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';

const workspace = aWorkspace({ name: 'cascadia' });
const project = aProject({ workspaceId: workspace.id, name: 'cascadia' });
const lapSession = aSession({ workspaceId: workspace.id });

const h = vi.hoisted(() => ({
  pick: vi.fn(async (): Promise<string | null> => null),
  store: {
    settings: {} as Record<string, string>,
    createNewProject: vi.fn(),
    addWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    ensureFirstLapSession: vi.fn(),
    navigate: vi.fn(),
    saveSetting: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));
vi.mock('../../lib/homeFolder', () => ({ homeFolder: async () => '/Users/dana' }));
vi.mock('../../hooks/usePickFolder', () => ({ usePickFolder: () => h.pick }));

import { CommandError } from '../../lib/invokeCommand';
import { NewProjectForm } from './index';

beforeEach(() => {
  h.pick.mockReset();
  h.pick.mockResolvedValue(null);
  h.store.settings = {};
  h.store.createNewProject.mockReset();
  h.store.createNewProject.mockResolvedValue({ workspace, project });
  h.store.addWorkspace.mockReset();
  h.store.addWorkspace.mockResolvedValue(workspace);
  h.store.openWorkspace.mockReset();
  h.store.openWorkspace.mockResolvedValue({ kind: 'opened' });
  h.store.ensureFirstLapSession.mockReset();
  h.store.ensureFirstLapSession.mockResolvedValue(lapSession);
  h.store.navigate.mockReset();
  h.store.saveSetting.mockReset();
  h.store.saveSetting.mockResolvedValue(undefined);
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
    expect(screen.getByText('Use letters, numbers, dashes, dots and underscores')).toBeDefined();
    expect(create).toHaveProperty('disabled', true);

    typeName('cascadia');
    expect(screen.queryByText(/Use letters/)).toBeNull();
    expect(await screen.findByText('/Users/dana/cascadia')).toBeDefined();
    expect(create).toHaveProperty('disabled', false);
  });

  it('lists the four things the click does', () => {
    render(<NewProjectForm />);

    expect(screen.getByText('Creates the project folder')).toBeDefined();
    expect(screen.getByText('Starts a git repository on main')).toBeDefined();
    expect(
      screen.getByText('Makes a first commit with a .gitignore and nothing else'),
    ).toBeDefined();
    expect(screen.getByText('Opens a first session that works in that folder')).toBeDefined();
  });

  it('creates the project, remembers the location, opens it and starts the first lap', async () => {
    const onCreated = vi.fn();
    render(<NewProjectForm onCreated={onCreated} />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(h.store.navigate).toHaveBeenCalledTimes(1));
    expect(h.store.createNewProject).toHaveBeenCalledWith({
      parentPath: '/Users/dana',
      name: 'cascadia',
    });
    expect(h.store.saveSetting).toHaveBeenCalledWith('new-project.parent', '/Users/dana');
    expect(h.store.openWorkspace).toHaveBeenCalledWith({
      id: workspace.id,
      title: 'cascadia',
      onRunning: 'new-window',
    });
    expect(h.store.ensureFirstLapSession).toHaveBeenCalledWith({ projectId: project.id });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('uses the folder the person picked as the location', async () => {
    h.pick.mockResolvedValue('/Volumes/work/games');
    render(<NewProjectForm />);
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(await screen.findByText('/Volumes/work/games/cascadia')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(h.store.createNewProject).toHaveBeenCalledWith({
        parentPath: '/Volumes/work/games',
        name: 'cascadia',
      }),
    );
  });

  it('says when the folder exists and offers to open it instead', async () => {
    h.store.createNewProject.mockRejectedValue(
      new CommandError({ kind: 'already_exists', message: '/Users/dana/cascadia already exists' }),
    );
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('A folder named cascadia already exists here')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open it instead' }));

    await waitFor(() =>
      expect(h.store.addWorkspace).toHaveBeenCalledWith({ rootPath: '/Users/dana/cascadia' }),
    );
    expect(h.store.navigate).not.toHaveBeenCalled();
  });

  it('keeps the project and says what is missing when the first session cannot start', async () => {
    h.store.ensureFirstLapSession.mockRejectedValue(new Error('Connect an agent first'));
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('The project is ready. Connect an agent first')).toBeDefined();
    expect(h.store.navigate).not.toHaveBeenCalled();
  });

  it('shows a Rust refusal without opening anything', async () => {
    h.store.createNewProject.mockRejectedValue(
      new CommandError({
        kind: 'nested_repo',
        message: 'this folder is already inside a repository',
      }),
    );
    render(<NewProjectForm />);
    await screen.findByText('/Users/dana/your-project');
    typeName('cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('this folder is already inside a repository')).toBeDefined();
    expect(h.store.openWorkspace).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Open it instead' })).toBeNull();
  });
});
