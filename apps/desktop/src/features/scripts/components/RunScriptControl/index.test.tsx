// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

type MockState = {
  workspaceScripts: Record<string, ReadonlyArray<{ id: string; name: string; body: string }>>;
  scriptRuns: Record<string, Record<string, { status: string; result: unknown }>>;
  loadScripts: ReturnType<typeof vi.fn>;
  runScript: ReturnType<typeof vi.fn>;
  cancelScript: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    workspaceScripts: {},
    scriptRuns: {},
    loadScripts: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

import { RunScriptControl } from './index';

beforeEach(() => {
  state.workspaceScripts = {
    'ws-1': [{ id: 'sc-1', name: 'sync env', body: 'cp .env .env.local' }],
  };
  state.scriptRuns = {};
  state.loadScripts = vi.fn(async () => undefined);
  state.runScript = vi.fn(async () => undefined);
  state.cancelScript = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('RunScriptControl', () => {
  it('disables the trigger when the session has no worktree', () => {
    render(
      <RunScriptControl
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath={null}
      />,
    );
    const btn = screen.getByRole('button', { name: /run workspace script/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the menu and lists the workspace scripts', () => {
    render(
      <RunScriptControl
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run workspace script/i }));
    expect(screen.getByText('sync env')).toBeDefined();
  });

  it('runs the script when its row is clicked', () => {
    render(
      <RunScriptControl
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run workspace script/i }));
    fireEvent.click(screen.getByText('sync env'));
    expect(state.runScript).toHaveBeenCalledWith('sess-1', 'sc-1', '/wt');
  });
});
