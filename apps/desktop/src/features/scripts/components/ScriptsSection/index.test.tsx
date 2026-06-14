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

import { ScriptsSection } from './index';

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

describe('ScriptsSection', () => {
  it('shows a create-script entry when the workspace has no scripts', () => {
    state.workspaceScripts = {};
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    expect(screen.getByText('Create script')).toBeDefined();
  });

  it('opens workspace script settings from the create-script entry', () => {
    state.workspaceScripts = {};
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-settings', spy);
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByText('Create script'));
    window.removeEventListener('goodboy:open-workspace-settings', spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0]![0] as CustomEvent).detail).toEqual({ section: 'scripts' });
  });

  it('lists the workspace scripts', () => {
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    expect(screen.getByText('sync env')).toBeDefined();
  });

  it('disables the run control when the session has no worktree', () => {
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath={null}
      />,
    );
    expect(
      (screen.getByRole('button', { name: /run script/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('runs the script when its run control is clicked', () => {
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run script/i }));
    expect(state.runScript).toHaveBeenCalledWith('sess-1', 'sc-1', '/wt');
  });

  it('stops a pending script', () => {
    state.scriptRuns = { 'sess-1': { 'sc-1': { status: 'pending', result: null } } };
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /stop script/i }));
    expect(state.cancelScript).toHaveBeenCalledWith('sess-1', 'sc-1');
  });
});
