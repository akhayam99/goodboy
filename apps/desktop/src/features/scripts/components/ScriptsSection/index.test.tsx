// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

type MockState = {
  projectScripts: Record<string, ReadonlyArray<{ id: string; name: string; body: string }>>;
  scriptRuns: Record<string, Record<string, { status: string; result: unknown }>>;
  sessionPanelExpanded: Record<string, Partial<Record<string, boolean>>>;
  setPanelSectionExpanded: ReturnType<typeof vi.fn>;
  loadScripts: ReturnType<typeof vi.fn>;
  runScript: ReturnType<typeof vi.fn>;
  cancelScript: ReturnType<typeof vi.fn>;
  setActiveLens: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    projectScripts: {},
    scriptRuns: {},
    sessionPanelExpanded: {},
    setPanelSectionExpanded: vi.fn(),
    loadScripts: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

import { ScriptsSection } from './index';

beforeEach(() => {
  state.projectScripts = {
    'ws-1': [{ id: 'sc-1', name: 'sync env', body: 'cp .env .env.local' }],
  };
  state.scriptRuns = {};
  state.sessionPanelExpanded = { 'sess-1': { scripts: true } };
  state.setPanelSectionExpanded = vi.fn();
  state.loadScripts = vi.fn(async () => undefined);
  state.runScript = vi.fn(async () => undefined);
  state.cancelScript = vi.fn(async () => undefined);
  state.setActiveLens = vi.fn();
});
afterEach(cleanup);

describe('ScriptsSection', () => {
  it('shows a create-script entry when the workspace has no scripts', () => {
    state.projectScripts = {};
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    expect(screen.getByText('Create script')).toBeDefined();
  });

  it('opens the session scripts lens from the create-script entry', () => {
    state.projectScripts = {};
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByText('Create script'));
    expect(state.setActiveLens).toHaveBeenCalledWith('sess-1', 'scripts');
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
    expect(screen.queryByText('cp .env .env.local')).toBeNull();
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

  it('defaults to collapsed, hiding rows behind a count summary', () => {
    state.sessionPanelExpanded = {};
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    expect(screen.queryByText('sync env')).toBeNull();
    expect(screen.getByText('1 script')).toBeDefined();
  });

  it('persists the expanded state through the store when toggled', () => {
    state.sessionPanelExpanded = {};
    render(
      <ScriptsSection
        sessionId={'sess-1' as never}
        workspaceId={'ws-1' as never}
        worktreePath="/wt"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand scripts/i }));
    expect(state.setPanelSectionExpanded).toHaveBeenCalledWith('sess-1', 'scripts', true);
  });
});
