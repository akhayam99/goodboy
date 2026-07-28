// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

type Script = {
  readonly id: string;
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
    scriptRuns: {} as Record<string, Record<string, RunRecord>>,
    loadScripts: vi.fn(async () => undefined),
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    workspaceScripts: { 'ws-1': state.scripts },
    scriptRuns: { 'session-1': state.scriptRuns['session-1'] ?? {} },
    loadScripts: state.loadScripts,
    saveScript: state.saveScript,
    deleteScript: state.deleteScript,
    runScript: state.runScript,
    cancelScript: state.cancelScript,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  return { useAppStore };
});

import { ScriptsPanel } from './index';

beforeEach(() => {
  state.scripts = [];
  state.scriptRuns = {};
  state.loadScripts = vi.fn(async () => undefined);
  state.saveScript = vi.fn(async () => undefined);
  state.deleteScript = vi.fn(async () => undefined);
  state.runScript = vi.fn(async () => undefined);
  state.cancelScript = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('ScriptsPanel', () => {
  it('loads scripts with the panel closed and renders the empty hint when none exist', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(
      screen.getByText(/scripts are shared across every session of this workspace/i),
    ).toBeDefined();
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
  });

  it('reveals the editor when "New script" is clicked', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    expect(screen.getByPlaceholderText(/script name/i)).toBeDefined();
  });

  it('saves a new script via store action when filled in and opens its detail panel', async () => {
    state.saveScript = vi.fn(async () => {
      state.scripts = [{ id: 's1', name: 'copy env', body: 'cp ../main/.env .env' }];
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
      id: undefined,
      name: 'copy env',
      body: 'cp ../main/.env .env',
    });
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.getByRole('button', { name: /close script panel/i })).toBeDefined();
  });

  it('opens a row in the detail panel instead of the editor', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: '#!/bin/bash\necho hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '#!/bin/bash\necho hi',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /close script panel/i })).toBeDefined();
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
  });

  it('opens an existing script from its row Edit action and saves an edit to its body', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: '#!/bin/bash\necho hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    const textarea = screen.getByDisplayValue(/echo hi/);
    fireEvent.change(textarea, { target: { value: 'echo hi again' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      id: 's1',
      name: 'setup',
      body: 'echo hi again',
    });
  });

  it('switches from detail mode to the editor with the detail Edit button', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByDisplayValue('setup')).toBeDefined();
    expect(screen.getByDisplayValue('echo hi')).toBeDefined();
  });

  it('deletes a script from its inline row action', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete script' }));
    });
    expect(state.deleteScript).toHaveBeenCalledWith('s1', 'ws-1');
  });

  it('closes the detail panel from the inspector header', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    fireEvent.click(screen.getByRole('button', { name: /close script panel/i }));
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
  });

  it('prompts before discarding an unsaved edit and applies the pending detail transition', () => {
    state.scripts = [
      { id: 's1', name: 'setup', body: 'echo one' },
      { id: 's2', name: 'build', body: 'echo two' },
    ];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    const setupRow = screen.getAllByRole('listitem')[0]!;
    fireEvent.click(within(setupRow).getByRole('button', { name: 'Edit script' }));
    fireEvent.change(screen.getByDisplayValue(/echo one/), {
      target: { value: 'echo one changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /build/i }));
    expect(screen.getByText(/unsaved changes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByDisplayValue(/echo two/)).toBeNull();
    expect(screen.getByRole('button', { name: /build/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('runs a script without opening the panel and routes output to its session', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(
      <ScriptsPanel
        workspaceId={'ws-1' as never}
        sessionId={'session-1' as never}
        worktreePath="/tmp/work"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run script' }));
    expect(state.runScript).toHaveBeenCalledWith('session-1', 's1', '/tmp/work');
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
  });

  it('shows success and danger dots for finished runs', () => {
    state.scripts = [
      { id: 's1', name: 'setup', body: 'echo one' },
      { id: 's2', name: 'build', body: 'echo two' },
    ];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status: 'ok',
          result: { stdout: 'done', stderr: '', exitCode: 0 },
          runId: 'run-1',
        },
        s2: {
          status: 'error',
          result: { stdout: '', stderr: 'failed', exitCode: 1 },
          runId: 'run-2',
        },
      },
    };
    render(
      <ScriptsPanel
        workspaceId={'ws-1' as never}
        sessionId={'session-1' as never}
        worktreePath="/tmp/work"
      />,
    );
    expect(screen.getByRole('img', { name: 'Script run succeeded' }).className).toContain(
      'bg-success',
    );
    expect(screen.getByRole('img', { name: 'Script run failed' }).className).toContain('bg-danger');
  });
});
