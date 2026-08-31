// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

type MockState = {
  projectScripts: Record<
    string,
    ReadonlyArray<{ id: string; projectId: string; name: string; body: string }>
  >;
  projects: ReadonlyArray<{ id: string; workspaceId: string; name: string }>;
  sessionProjectMounts: Record<string, ReadonlyArray<{ projectId: string; worktreePath: string }>>;
  scriptRuns: Record<string, Record<string, { status: string; result: unknown }>>;
  sessionPanelExpanded: Record<string, Partial<Record<string, boolean>>>;
  setPanelSectionExpanded: ReturnType<typeof vi.fn>;
  loadScripts: ReturnType<typeof vi.fn>;
  runScript: ReturnType<typeof vi.fn>;
  cancelScript: ReturnType<typeof vi.fn>;
  setActiveLens: ReturnType<typeof vi.fn>;
  setScriptsLensScope: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    projectScripts: {},
    projects: [],
    sessionProjectMounts: {},
    scriptRuns: {},
    sessionPanelExpanded: {},
    setPanelSectionExpanded: vi.fn(),
    loadScripts: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
  EMPTY_ARRAY: [],
}));

import { ScriptsSection } from './index';

beforeEach(() => {
  state.projectScripts = {
    'ws-1': [{ id: 'sc-1', projectId: 'project-1', name: 'sync env', body: 'cp .env .env.local' }],
  };
  state.projects = [{ id: 'project-1', workspaceId: 'ws-1', name: 'API' }];
  state.sessionProjectMounts = {
    'sess-1': [{ projectId: 'project-1', worktreePath: '/wt/api' }],
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
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    expect(screen.getByText('Create script')).toBeDefined();
  });

  it('opens the session scripts lens from the create-script entry', () => {
    state.projectScripts = {};
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByText('Create script'));
    expect(state.setActiveLens).toHaveBeenCalledWith('sess-1', 'scripts');
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
  });

  it('lists the workspace scripts', () => {
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    expect(screen.getByText('sync env')).toBeDefined();
    expect(screen.queryByText('cp .env .env.local')).toBeNull();
  });

  it('disables the run control when the script project is not mounted', () => {
    state.sessionProjectMounts = {};
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    expect(
      (screen.getByRole('button', { name: /run script/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('runs the script when its run control is clicked', () => {
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /run script/i }));
    expect(state.runScript).toHaveBeenCalledWith({ sessionId: 'sess-1', scriptId: 'sc-1' });
  });

  it('stops a pending script', () => {
    state.scriptRuns = { 'sess-1': { 'sc-1': { status: 'pending', result: null } } };
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /stop script/i }));
    expect(state.cancelScript).toHaveBeenCalledWith('sess-1', 'sc-1');
  });

  it('defaults to collapsed, hiding rows behind a count summary', () => {
    state.sessionPanelExpanded = {};
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    expect(screen.queryByText('sync env')).toBeNull();
    expect(screen.getByText('1 script')).toBeDefined();
  });

  it('persists the expanded state through the store when toggled', () => {
    state.sessionPanelExpanded = {};
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /expand scripts/i }));
    expect(state.setPanelSectionExpanded).toHaveBeenCalledWith('sess-1', 'scripts', true);
  });

  it('shows project suffixes and disables only the unmounted project script', () => {
    state.projects = [
      { id: 'project-1', workspaceId: 'ws-1', name: 'API' },
      { id: 'project-2', workspaceId: 'ws-1', name: 'Web' },
    ];
    state.projectScripts = {
      'ws-1': [
        { id: 'sc-1', projectId: 'project-1', name: 'sync api', body: 'echo api' },
        { id: 'sc-2', projectId: 'project-2', name: 'sync web', body: 'echo web' },
      ],
    };
    render(<ScriptsSection sessionId={'sess-1' as never} workspaceId={'ws-1' as never} />);

    const runButtons = screen.getAllByRole('button', { name: 'Run script' });
    expect((runButtons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((runButtons[1] as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('· API')).toBeDefined();
    expect(screen.getByText('· Web')).toBeDefined();
  });
});
