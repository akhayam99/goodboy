// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

type Script = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly body: string;
};

type RunRecord = {
  readonly status: 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';
  readonly result: { stdout: string; stderr: string; exitCode: number } | null;
  readonly runId: string;
};

const { state } = vi.hoisted(() => ({
  state: {
    scripts: [] as ReadonlyArray<Script>,
    projects: [{ id: 'project-1', workspaceId: 'ws-1', name: 'API' }],
    sessions: [{ id: 'session-1', activeProjectId: 'project-1' }],
    sessionActiveProject: { 'session-1': 'project-1' } as Record<string, string>,
    sessionProjectMounts: {
      'session-1': [{ projectId: 'project-1', worktreePath: '/tmp/api' }],
    } as Record<string, ReadonlyArray<{ projectId: string; worktreePath: string }>>,
    scriptRuns: {} as Record<string, Record<string, RunRecord>>,
    loadScripts: vi.fn(async () => undefined),
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    scriptsLensScope: null as { readonly projectId: string } | null,
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    projectScripts: { 'ws-1': state.scripts },
    projects: state.projects,
    sessions: state.sessions,
    sessionActiveProject: state.sessionActiveProject,
    sessionProjectMounts: state.sessionProjectMounts,
    scriptRuns: { 'session-1': state.scriptRuns['session-1'] ?? {} },
    loadScripts: state.loadScripts,
    saveScript: state.saveScript,
    deleteScript: state.deleteScript,
    runScript: state.runScript,
    cancelScript: state.cancelScript,
    scriptsLensScope: state.scriptsLensScope,
    setScriptsLensScope: state.setScriptsLensScope,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  return { useAppStore };
});

import { ScriptsPanel } from './index';

beforeEach(() => {
  state.scripts = [];
  state.projects = [{ id: 'project-1', workspaceId: 'ws-1', name: 'API' }];
  state.sessions = [{ id: 'session-1', activeProjectId: 'project-1' }];
  state.sessionActiveProject = { 'session-1': 'project-1' };
  state.sessionProjectMounts = {
    'session-1': [{ projectId: 'project-1', worktreePath: '/tmp/api' }],
  };
  state.scriptRuns = {};
  state.loadScripts = vi.fn(async () => undefined);
  state.saveScript = vi.fn(async () => undefined);
  state.deleteScript = vi.fn(async () => undefined);
  state.runScript = vi.fn(async () => undefined);
  state.cancelScript = vi.fn(async () => undefined);
  state.scriptsLensScope = null;
  state.setScriptsLensScope = vi.fn();
});

afterEach(cleanup);

describe('ScriptsPanel', () => {
  it('consumes a scoped open and preselects its project tab', () => {
    state.projects = [
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
    ];
    state.scriptsLensScope = { projectId: 'project-2' };
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' },
      { id: 's2', projectId: 'project-2', name: 'deploy web', body: 'echo web' },
    ];

    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    expect(screen.getByRole('tab', { name: 'Web' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('deploy web')).toBeDefined();
    expect(screen.queryByText('setup api')).toBeNull();
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
  });

  it('uses All for a generic open', () => {
    state.projects = [
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
    ];
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' },
      { id: 's2', projectId: 'project-2', name: 'deploy web', body: 'echo web' },
    ];

    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByRole('tab', { name: 'All' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('setup api')).toBeDefined();
    expect(screen.getByText('deploy web')).toBeDefined();
  });

  it('orders project tabs, groups, and scripts alphabetically', () => {
    state.projects = [
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
    ];
    state.scripts = [
      { id: 's2', projectId: 'project-1', name: 'zebra', body: 'echo z' },
      { id: 's3', projectId: 'project-2', name: 'deploy', body: 'echo deploy' },
      { id: 's1', projectId: 'project-1', name: 'Alpha', body: 'echo a' },
    ];

    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['All', 'API', 'Web']);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Alpha'),
      expect.stringContaining('zebra'),
      expect.stringContaining('deploy'),
    ]);
  });

  it('loads scripts and renders the empty hint when none exist', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(
      screen.getAllByText(/scripts are shared across every session of the workspace/i).length,
    ).toBeGreaterThan(0);
  });

  it('creates a new script in an inline card', async () => {
    state.saveScript = vi.fn(async () => {
      state.scripts = [
        { id: 's1', projectId: 'project-1', name: 'copy env', body: 'cp ../main/.env .env' },
      ];
    });
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    fireEvent.change(screen.getByPlaceholderText(/script name/i), {
      target: { value: 'copy env' },
    });
    fireEvent.change(screen.getByPlaceholderText(/cp \.\.\/main\/\.env/i), {
      target: { value: 'cp ../main/.env .env' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: undefined,
      name: 'copy env',
      body: 'cp ../main/.env .env',
    });
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.getByTestId('script-card-s1')).toBeDefined();
    expect(screen.getByText('cp ../main/.env .env')).toBeDefined();
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /project/i })).toBeNull();
    expect(screen.queryByText('API')).toBeNull();
  });

  it('expands an existing script in place with its full command', () => {
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup', body: '#!/bin/bash\necho hi' },
    ];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('+1 line')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));

    expect(screen.getByTestId('script-card-s1').className).toContain('bg-muted/20');
    expect(screen.getByTestId('script-card-s1').className).not.toContain('bg-card/40');
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '#!/bin/bash\necho hi',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
  });

  it('edits an existing command inline and commits on blur', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit setup command' });
    fireEvent.change(textarea, { target: { value: 'echo hi again' } });
    await act(async () => {
      fireEvent.blur(textarea);
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: 's1',
      name: 'setup',
      body: 'echo hi again',
    });
  });

  it('edits an existing script name inline and commits with Cmd+Enter', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'setup' }));
    const nameInput = screen.getByRole('textbox', { name: 'Edit script name' });
    fireEvent.change(nameInput, { target: { value: 'bootstrap' } });
    await act(async () => {
      fireEvent.keyDown(nameInput, { key: 'Enter', metaKey: true });
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: 's1',
      name: 'bootstrap',
      body: 'echo hi',
    });
  });

  it('keeps the discard guard for an unfinished new script', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    fireEvent.change(screen.getByPlaceholderText(/script name/i), {
      target: { value: 'unfinished' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));

    expect(screen.getByText(/unsaved changes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse setup' })).toBeDefined();
  });

  it('deletes a script through its lifecycle action after confirmation', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    const lifecycleSlot = screen.getByRole('group', { name: 'Script lifecycle actions' });
    const deleteAction = screen.getByRole('button', { name: 'Delete script' });
    expect(lifecycleSlot.contains(deleteAction)).toBe(true);
    fireEvent.click(deleteAction);
    expect(state.deleteScript).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Delete "setup"?' })).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    });

    expect(state.deleteScript).toHaveBeenCalledWith('s1', 'ws-1');
  });

  it('runs a script without expanding it', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run script' }));
    expect(state.runScript).toHaveBeenCalledWith({ sessionId: 'session-1', scriptId: 's1' });
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeDefined();
  });

  it('shows the last run output inside an expanded card', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status: 'ok',
          result: { stdout: 'completed output', stderr: '', exitCode: 0 },
          runId: 'run-1',
        },
      },
    };
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    expect(screen.queryByText('completed output')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));
    expect(screen.getByText('Last run')).toBeDefined();
    expect(screen.getByText('completed output')).toBeDefined();
  });

  it('renders an idle script row with no status border accent', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain('border-transparent');
    expect(row.className).toContain('bg-card/40');
    expect(row.className).not.toContain('bg-muted/20');
    expect(row.className).not.toContain('border-info/50');
    expect(row.className).not.toContain('border-success/40');
    expect(row.className).not.toContain('border-danger/40');
    expect(row.querySelector('[role="img"]')).toBeNull();
  });

  it.each([
    ['pending', 'border-info/50', 'motion-safe:animate-pulse'],
    ['ok', 'border-success/40', null],
    ['error', 'border-danger/40', null],
    ['cancelled', 'border-border', null],
  ] as const)('uses the %s run state for the row border', (status, borderClass, pulseClass) => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status,
          result: status === 'pending' ? null : { stdout: '', stderr: '', exitCode: 0 },
          runId: 'run-1',
        },
      },
    };
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain(borderClass);
    if (pulseClass !== null) {
      expect(row.className).toContain(pulseClass);
    }
    expect(row.querySelector('[role="img"]')).toBeNull();
  });

  it('groups the All view, filters by project, and explains an unmounted project', () => {
    state.projects = [
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
    ];
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' },
      { id: 's2', projectId: 'project-2', name: 'deploy web', body: 'echo web' },
    ];
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeDefined();
    expect(screen.getAllByText('API').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Web').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Expand deploy web' }));
    expect(screen.getByText('Web is not mounted in this session')).toBeDefined();
    expect(
      (screen.getAllByRole('button', { name: 'Run script' })[1] as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'API' }));
    expect(screen.getByText('setup api')).toBeDefined();
    expect(screen.queryByText('deploy web')).toBeNull();
  });

  it('defaults a new script to the active project and allows reassignment while editing', async () => {
    state.projects = [
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
    ];
    state.sessionActiveProject = { 'session-1': 'project-2' };
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    expect(
      (screen.getByRole('combobox', { name: 'New script project' }) as HTMLSelectElement).value,
    ).toBe('project-2');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Edit script project' }), {
        target: { value: 'project-2' },
      });
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-2',
      id: 's1',
      name: 'setup',
      body: 'echo hi',
    });
  });
});
