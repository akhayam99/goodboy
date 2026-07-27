// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      workspaceScripts: Record<string, ReadonlyArray<Script>>;
      scriptRuns: Record<string, Record<string, RunRecord>>;
      loadScripts: typeof state.loadScripts;
      saveScript: typeof state.saveScript;
      deleteScript: typeof state.deleteScript;
      runScript: typeof state.runScript;
      cancelScript: typeof state.cancelScript;
    }) => T,
  ) =>
    selector({
      workspaceScripts: { 'ws-1': state.scripts },
      scriptRuns: { 'session-1': state.scriptRuns['session-1'] ?? {} },
      loadScripts: state.loadScripts,
      saveScript: state.saveScript,
      deleteScript: state.deleteScript,
      runScript: state.runScript,
      cancelScript: state.cancelScript,
    }),
}));

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
  it('loads scripts on mount and renders the empty hint when none exist', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(
      screen.getByText(/scripts are shared across every session of this workspace/i),
    ).toBeDefined();
  });

  it('reveals the editor when "New script" is clicked', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    expect(screen.getByPlaceholderText(/script name/i)).toBeDefined();
  });

  it('saves a new script via store action when filled in', async () => {
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
  });

  it('opens an existing script and saves an edit to its body', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: '#!/bin/bash\necho hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
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

  it('deletes a script from its overflow menu', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Script actions' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    });
    expect(state.deleteScript).toHaveBeenCalledWith('s1', 'ws-1');
  });

  it('prompts before discarding an unsaved edit when switching to another script', () => {
    state.scripts = [
      { id: 's1', name: 'setup', body: 'echo one' },
      { id: 's2', name: 'build', body: 'echo two' },
    ];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    fireEvent.change(screen.getByDisplayValue(/echo one/), {
      target: { value: 'echo one changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /build/i }));
    expect(screen.getByText(/unsaved changes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByDisplayValue(/echo two/)).toBeDefined();
  });

  it('runs a script from its row and routes output to the session it runs in', () => {
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
  });
});
