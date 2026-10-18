// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, repoMocks } = vi.hoisted(() => {
  const noFolderOverrides = (): Record<string, string | null> => ({});
  return {
    state: {
      settings: {} as Record<string, string>,
      projects: [] as ReadonlyArray<Record<string, unknown>>,
      projectGitStatus: {} as Readonly<Record<string, Record<string, unknown>>>,
      projectRelocationWorkspaceId: null as string | null,
      projectRelocationCandidates: [] as ReadonlyArray<Record<string, unknown>>,
      projectRelocationCompleted: [] as ReadonlyArray<Record<string, unknown>>,
      projectRelocationPhase: 'idle',
      projectRelocationError: null as string | null,
      addProject: vi.fn(async (): Promise<Record<string, unknown>> => ({
        kind: 'linked',
        project: { id: 'proj-1', name: 'api', rootPath: '/repos/api' },
      })),
      addProjects: vi.fn(async () => ({ linked: [], conflicts: [] })),
      adoptProject: vi.fn(async () => ({
        movedSessionCount: 4,
        ambiguousSessionCount: 0,
        mergedWorkspace: true,
      })),
      previewProjectAdoption: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
      removeProject: vi.fn(async () => undefined),
      setProjectStarred: vi.fn(async () => undefined),
      describeProject: vi.fn(async () => undefined),
      updateProjectBaseBranch: vi.fn(async () => undefined),
      updateProjectAfterMerge: vi.fn(async () => undefined),
      workspaceOverrides: {} as Record<string, { readonly afterMerge: string | null }>,
      loadProjectGitStatus: vi.fn(async () => undefined),
      findMovedProjects: vi.fn(async () => undefined),
      setProjectRelocationSelected: vi.fn(),
      relocateProjects: vi.fn(async () => undefined),
      undoRelocation: vi.fn(async () => undefined),
      clearProjectRelocation: vi.fn(),
      reportError: vi.fn(async () => undefined),
      workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
      projectSentryLinks: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
      loadProjectSentryLinks: vi.fn(async () => undefined),
      projectRootScripts: {} as Record<string, unknown>,
      loadProjectRootScripts: vi.fn(async () => undefined),
      loadScriptPins: vi.fn(async () => undefined),
      toggleScriptPin: vi.fn(async () => undefined),
      terminalFolderOverrides: noFolderOverrides(),
      loadTerminalWorkspaceFolder: vi.fn(async () => undefined),
      setTerminalWorkspaceFolder: vi.fn(async () => undefined),
      folderPurpose: {},
      folderVersionsStatus: {},
      folderHistorySizes: {},
      setFolderPurpose: vi.fn(async () => 'documents'),
      loadFolderHistorySize: vi.fn(async () => undefined),
      prepareFolderVersions: vi.fn(async () => undefined),
    },
    repoMocks: {
      validateGitRepo: vi.fn(async () => ({
        isRepo: true,
        rootPath: '/repos/api',
        resolvedPath: '/repos/api',
        error: null,
      })),
      scanChildRepos: vi.fn(async (): Promise<ReadonlyArray<never>> => []),
      initRepo: vi.fn(async () => ({ rootPath: '/repos/api' })),
      dialogOpen: vi.fn(async (): Promise<string | null> => null),
    },
  };
});

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../shared/lib/repo', () => repoMocks);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: repoMocks.dialogOpen }));
vi.mock('./GoodboyIgnoreField', () => ({
  GoodboyIgnoreField: () => null,
}));

import { useAppStore as realStore } from '../../../../store/store';
import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';

const WORKSPACE_ID = 'ws-target' as WorkspaceId;

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [];
  state.projectGitStatus = {};
  state.projectRelocationWorkspaceId = null;
  state.projectRelocationCandidates = [];
  state.projectRelocationCompleted = [];
  state.projectRelocationPhase = 'idle';
  state.projectRelocationError = null;
  state.workspaceIntegrations = {};
  state.projectSentryLinks = {};
  state.projectGitStatus = {};
  state.workspaceOverrides = {};
  state.terminalFolderOverrides = {};
  state.projectRootScripts = {};
});
afterEach(cleanup);

const openEditor = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));

describe('WorkspaceProjectsSection', () => {
  it('offers to locate a repository whose saved folder is missing', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/old/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    state.projectGitStatus = { 'proj-ledger': { state: 'missing' } };
    repoMocks.dialogOpen.mockResolvedValueOnce('/new');
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    screen.getByText('1 folder is not where Goodboy left it.');
    fireEvent.click(screen.getByRole('button', { name: 'Locate folders' }));

    await waitFor(() =>
      expect(state.findMovedProjects).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        parent: '/new',
      }),
    );
  });

  it('shows repository verdicts and moves only selected candidates', () => {
    state.projectRelocationWorkspaceId = WORKSPACE_ID;
    state.projectRelocationPhase = 'preview';
    state.projectRelocationCandidates = [
      {
        projectId: 'proj-ledger',
        name: 'ledger-core',
        fromRoot: '/old/ledger-core',
        toRoot: '/new/ledger-core',
        verdict: 'same_repository',
        identity: null,
        isSelected: true,
        status: 'ready',
      },
      {
        projectId: 'proj-payments',
        name: 'payments-api',
        fromRoot: '/old/payments-api',
        toRoot: '/new/payments-api',
        verdict: 'different_repository',
        identity: null,
        isSelected: false,
        status: 'ready',
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    screen.getByText('Same repository');
    screen.getByText('Different repository');
    expect((screen.getByLabelText('Move payments-api') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move 1 folder' }));
    expect(state.relocateProjects).toHaveBeenCalledOnce();
  });

  it('shows the base branch picker in the editor, repo rows only', () => {
    state.projects = [
      {
        id: 'proj-docs',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
        overrides: { afterMerge: null },
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    openEditor('notify-relay');
    expect(screen.queryByRole('combobox', { name: 'Base branch' })).toBeNull();

    openEditor('ledger-core');
    expect(screen.getByRole('combobox', { name: 'Base branch' })).toBeDefined();
  });

  it('lets a repo override what happens after a merge, naming what it inherits', async () => {
    state.workspaceOverrides = { [WORKSPACE_ID]: { afterMerge: 'ask' } };
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
        overrides: { afterMerge: null },
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    openEditor('ledger-core');
    const field = screen.getByRole('combobox', { name: 'After merge in ledger-core' });
    expect(field.textContent).toContain('Same as workspace · Ask first');
    fireEvent.click(field);
    fireEvent.click(screen.getByRole('option', { name: 'Delete folder and branch on this Mac' }));

    await waitFor(() =>
      expect(state.updateProjectAfterMerge).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        afterMerge: 'local',
      }),
    );
  });

  it('unlinks a project from its opened row at once and Undo links the same folder again', async () => {
    state.projects = [
      {
        id: 'proj-docs',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.queryByRole('button', { name: 'Remove link to notify-relay' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit notify-relay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(state.removeProject).toHaveBeenCalledWith({ projectId: 'proj-docs' }),
    );
    await waitFor(() => expect(realStore.getState().undoStack.length).toBeGreaterThan(0));
    await realStore.getState().undoLastOperation();

    expect(state.addProject).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      rootPath: '/repos/notify-relay',
      requireRepo: false,
    });
  });

  it('stars a project from its row', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    const star = screen.getByRole('button', { name: 'Starred: ledger-core' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(star);

    await waitFor(() =>
      expect(state.setProjectStarred).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        isStarred: true,
      }),
    );
  });

  it('shows a starred project as pressed, grouped under Starred, and unstars it', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
        starredAt: '2026-09-25T09:00:00.000Z',
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeDefined();
    expect(screen.getByText('Agents and pickers list these first.')).toBeDefined();
    const star = screen.getByRole('button', { name: 'Starred: ledger-core' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(star);

    await waitFor(() =>
      expect(state.setProjectStarred).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        isStarred: false,
      }),
    );
  });

  it('edits and saves a one-line description from the row editor on Enter', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    openEditor('ledger-core');
    const field = screen.getByLabelText('Description of ledger-core');
    fireEvent.change(field, { target: { value: 'Settles payments and writes the ledger' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(state.describeProject).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        description: 'Settles payments and writes the ledger',
      }),
    );
  });

  it('keeps the description when editing is cancelled with Escape', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
        description: 'Settles payments',
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    openEditor('ledger-core');
    const field = screen.getByLabelText('Description of ledger-core') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(field.value).toBe('Settles payments');
    expect(state.describeProject).not.toHaveBeenCalled();
  });

  it('marks a project with the Sentry projects it reads', async () => {
    state.workspaceIntegrations = { [WORKSPACE_ID]: [{ provider: 'sentry' }] };
    state.projects = [
      {
        id: 'proj-ledger',
        workspaceId: WORKSPACE_ID,
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
      },
    ];
    state.projectSentryLinks = {
      [WORKSPACE_ID]: [
        { projectId: 'proj-ledger', sentryProject: 'payments-api', sentryProjectName: null },
        {
          projectId: 'proj-ledger',
          sentryProject: 'payments-worker',
          sentryProjectName: 'Payments worker',
        },
      ],
    };

    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(
      screen.getByRole('img', { name: 'Sentry: payments-api, Payments worker' }),
    ).toBeDefined();
    await waitFor(() =>
      expect(state.loadProjectSentryLinks).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID }),
    );
  });

  it('flags a repo row whose folder is missing', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    state.projectGitStatus = { 'proj-ledger': { state: 'missing' } };
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText('Folder not found')).toBeDefined();
  });

  it('shows the first 8 projects and reveals the rest on Show more', () => {
    state.projects = Array.from({ length: 9 }, (_, index) => ({
      id: `proj-${index}`,
      name: `project-${index}`,
      rootPath: `/repos/project-${index}`,
      kind: 'folder',
      workspaceId: WORKSPACE_ID,
    }));
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getAllByRole('img', { name: 'Folder' })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(screen.getAllByRole('img', { name: 'Folder' })).toHaveLength(9);
  });

  it('keeps scripts off the row and shows them in the open editor card with the pinned count', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
        baseBranch: 'main',
        overrides: { afterMerge: null },
      },
    ];
    state.projectRootScripts = {
      '/repos/ledger-core': {
        status: 'ready',
        error: null,
        groups: [
          {
            source: 'package-json',
            packageName: 'ledger-core',
            relDir: '',
            manager: 'pnpm',
            scripts: [
              { name: 'dev', command: 'pnpm run dev', body: 'vite --port 4310' },
              { name: 'test', command: 'pnpm run test', body: 'vitest run' },
            ],
          },
        ],
      },
    };
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.queryByRole('button', { name: /^Scripts of/ })).toBeNull();
    expect(screen.queryByText('Scripts')).toBeNull();

    openEditor('ledger-core');

    const scripts = screen.getByRole('group', { name: 'Scripts of ledger-core' });
    within(scripts).getByText('Scripts');
    expect(within(scripts).getByRole('button', { name: 'Pin dev' })).toBeDefined();
    expect(within(scripts).getByRole('button', { name: 'Pin test' })).toBeDefined();
    expect(state.loadProjectRootScripts).toHaveBeenCalledWith({ rootPath: '/repos/ledger-core' });
  });

  it('shows a failed scripts scan as a notice with Retry', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
        overrides: { afterMerge: null },
      },
    ];
    state.projectRootScripts = {
      '/repos/ledger-core': { status: 'error', error: 'permission denied', groups: [] },
    };
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);
    openEditor('ledger-core');
    state.loadProjectRootScripts.mockClear();

    const notice = screen.getByRole('alert');
    within(notice).getByText('permission denied');
    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));

    expect(state.loadProjectRootScripts).toHaveBeenCalledWith({ rootPath: '/repos/ledger-core' });
  });

  it('shows the computed terminal folder once above the list and lets it change', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
      {
        id: 'proj-relay',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    repoMocks.dialogOpen.mockResolvedValueOnce('/work/harborline');
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    const row = screen.getByRole('group', { name: 'Terminal folder' });
    within(row).getByText('/repos');
    expect(within(row).queryByRole('button', { name: 'Use the default' })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Change' }));

    await waitFor(() =>
      expect(state.setTerminalWorkspaceFolder).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        folder: '/work/harborline',
      }),
    );
  });

  it('offers Use the default when the terminal folder is overridden', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    state.terminalFolderOverrides = { [WORKSPACE_ID]: '/work/harborline' };
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    const row = screen.getByRole('group', { name: 'Terminal folder' });
    within(row).getByText('/work/harborline');
    fireEvent.click(within(row).getByRole('button', { name: 'Use the default' }));

    await waitFor(() =>
      expect(state.setTerminalWorkspaceFolder).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        folder: null,
      }),
    );
  });

  it('shows no terminal folder row before a project is linked', () => {
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.queryByRole('group', { name: 'Terminal folder' })).toBeNull();
  });
});
