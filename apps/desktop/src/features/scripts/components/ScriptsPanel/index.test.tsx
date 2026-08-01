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
  it('loads scripts and renders the empty hint when none exist', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(
      screen.getByText(/scripts are shared across every session of this workspace/i),
    ).toBeDefined();
  });

  it('creates a new script in an inline card', async () => {
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
    expect(screen.getByTestId('script-card-s1')).toBeDefined();
    expect(screen.getByText('cp ../main/.env .env')).toBeDefined();
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
  });

  it('expands an existing script in place with its full command', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: '#!/bin/bash\necho hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('+1 line')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '#!/bin/bash\necho hi',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /close script panel/i })).toBeNull();
  });

  it('edits an existing command inline and commits on blur', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit setup command' });
    fireEvent.change(textarea, { target: { value: 'echo hi again' } });
    await act(async () => {
      fireEvent.blur(textarea);
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      id: 's1',
      name: 'setup',
      body: 'echo hi again',
    });
  });

  it('edits an existing script name inline and commits with Cmd+Enter', async () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
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
      id: 's1',
      name: 'bootstrap',
      body: 'echo hi',
    });
  });

  it('keeps the discard guard for an unfinished new script', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
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
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
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
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeDefined();
  });

  it('shows the last run output inside an expanded card', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status: 'ok',
          result: { stdout: 'completed output', stderr: '', exitCode: 0 },
          runId: 'run-1',
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

    expect(screen.queryByText('completed output')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));
    expect(screen.getByText('Last run')).toBeDefined();
    expect(screen.getByText('completed output')).toBeDefined();
  });

  it('renders an idle script row with no status border accent', () => {
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    render(
      <ScriptsPanel
        workspaceId={'ws-1' as never}
        sessionId={'session-1' as never}
        worktreePath="/tmp/work"
      />,
    );

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain('border-transparent');
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
    state.scripts = [{ id: 's1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status,
          result: status === 'pending' ? null : { stdout: '', stderr: '', exitCode: 0 },
          runId: 'run-1',
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

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain(borderClass);
    if (pulseClass !== null) {
      expect(row.className).toContain(pulseClass);
    }
    expect(row.querySelector('[role="img"]')).toBeNull();
  });
});
