// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, hooks, toastMock } = vi.hoisted(() => ({
  state: {
    skills: {} as Record<string, ReadonlyArray<unknown>>,
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    projectScripts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    agentKindOverride: {} as Record<string, string>,
    openWorkspace: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    setScriptsLensScope: vi.fn(),
    runScript: vi.fn(async () => ({ exitCode: 0 })),
  },
  hooks: {
    currentSession: null as { readonly id: string } | null,
    sessions: [] as ReadonlyArray<{ readonly id: string; readonly goal: string }>,
    workspaces: [] as ReadonlyArray<{ readonly id: string; readonly name: string }>,
    currentWorkspace: null as { readonly id: string; readonly name: string } | null,
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
  useWorkspaces: () => hooks.workspaces,
  useSessions: () => hooks.sessions,
  useCurrentWorkspace: () => hooks.currentWorkspace,
  useCurrentSession: () => hooks.currentSession,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { CommandPalette } from './index';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../../settings/reportIssueStudioEvent';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

beforeEach(() => {
  state.skills = {};
  state.phaseTemplates = {};
  state.projectScripts = {};
  state.sessionPhaseRuns = {};
  state.sessionWorktrees = {};
  state.agentKindOverride = {};
  state.setActiveLens.mockReset();
  hooks.currentSession = null;
  hooks.sessions = [];
  hooks.workspaces = [];
  hooks.currentWorkspace = null;
  toastMock.mockReset();
  state.openWorkspace.mockClear();
  state.setCurrentSession.mockClear();
});
afterEach(cleanup);

describe('CommandPalette', () => {
  it('renders the search input with the default placeholder', () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByLabelText(/command palette search/i)).toBeDefined();
  });

  it('shows the no-results row when nothing matches the query', () => {
    render(<CommandPalette onClose={vi.fn()} initialQuery="zzzz" />);
    expect(screen.getByText(/no results/i)).toBeDefined();
  });

  it.each([
    ['Connect a provider', 'provider', { scope: 'providers' }],
    ['Open settings', 'open settings', { scope: 'app' }],
    ['Keyboard shortcuts', 'keyboard', { scope: 'app', section: 'shortcuts' }],
  ] as const)('opens %s through the settings event', (label, query, detail) => {
    const listener = vi.fn();
    const onClose = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    render(<CommandPalette onClose={onClose} initialQuery={query} />);

    fireEvent.mouseDown(screen.getByText(label));

    window.removeEventListener('goodboy:open-settings', listener);
    const [event] = listener.mock.calls[0] ?? [];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual(detail);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('starts a session from New session, as the shortcut does', () => {
    hooks.currentWorkspace = { id: 'workspace-1', name: 'Harborline' };
    const listener = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    render(<CommandPalette onClose={vi.fn()} initialQuery="new session" />);

    fireEvent.mouseDown(screen.getByText('New session'));

    window.removeEventListener('goodboy:new-session', listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('offers New session only inside a workspace', () => {
    render(<CommandPalette onClose={vi.fn()} initialQuery="new session" />);

    expect(screen.queryByText('New session')).toBeNull();
  });

  it('opens the report issue studio through the shared studio event', () => {
    const listener = vi.fn();
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
    render(<CommandPalette onClose={vi.fn()} initialQuery="report an issue" />);

    fireEvent.mouseDown(screen.getByText('Report an issue'));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
  });

  it.each([
    ['Open Context', 'context'],
    ['Open Context: Goal', 'goal'],
    ['Open Context: Decisions', 'decisions'],
    ['Open Context: Session summary', 'last_output_summary'],
    ['Open Agents', 'agents'],
    ['Open Questions', 'questions'],
    ['Open Terminal', 'terminal'],
  ] as const)('routes %s to the shared surface it names', (label, lens) => {
    hooks.currentSession = { id: 'session-1' };
    render(<CommandPalette onClose={vi.fn()} initialQuery={label} />);

    fireEvent.mouseDown(screen.getByText(label));

    expect(state.setActiveLens).toHaveBeenCalledWith('session-1', lens);
  });

  it('keeps the session pages in the empty palette behind a wall of sessions', () => {
    hooks.currentSession = { id: 'session-1' };
    hooks.sessions = Array.from({ length: 24 }, (_, index) => ({
      id: `session-${index}`,
      goal: `settle batch ${index}`,
    }));
    hooks.workspaces = Array.from({ length: 6 }, (_, index) => ({
      id: `workspace-${index}`,
      name: `Harborline ${index}`,
    }));
    render(<CommandPalette onClose={vi.fn()} />);

    expect(screen.getByText('Open Artifacts')).toBeDefined();
    expect(screen.getByText('Open Review')).toBeDefined();
    expect(screen.queryByText('settle batch 20')).toBeNull();
  });

  it('keeps the global actions in the empty palette behind every destination', () => {
    hooks.currentSession = { id: 'session-1' };
    render(<CommandPalette onClose={vi.fn()} />);

    expect(screen.getByText('Open Terminal')).toBeDefined();
    expect(screen.getByText('Open settings')).toBeDefined();
    expect(screen.getByText('Report an issue')).toBeDefined();
  });

  it('selects the first rendered row on open, whatever group it belongs to', () => {
    hooks.workspaces = [{ id: 'workspace-1', name: 'Harborline' }];
    hooks.sessions = [{ id: 'session-9', goal: 'settle the ledger' }];
    render(<CommandPalette onClose={vi.fn()} />);

    const options = screen.getAllByRole('option');
    expect(options[0]?.textContent).toContain('settle the ledger');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(
      options.filter((option) => option.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1);
  });

  it('moves the highlight across a group boundary and keeps the active descendant on it', () => {
    hooks.workspaces = [{ id: 'workspace-1', name: 'Harborline' }];
    hooks.sessions = [{ id: 'session-9', goal: 'settle the ledger' }];
    render(<CommandPalette onClose={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options[1]?.textContent).toContain('Harborline');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
  });

  it('runs the highlighted row on enter', () => {
    hooks.workspaces = [{ id: 'workspace-1', name: 'Harborline' }];
    hooks.sessions = [{ id: 'session-9', goal: 'settle the ledger' }];
    const onClose = vi.fn();
    render(<CommandPalette onClose={onClose} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(state.openWorkspace).toHaveBeenCalledWith('workspace-1', 'Harborline');
    expect(state.setCurrentSession).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names the list as a listbox and its group headers as presentation', () => {
    hooks.sessions = [{ id: 'session-9', goal: 'settle the ledger' }];
    render(<CommandPalette onClose={vi.fn()} />);

    const input = screen.getByRole('combobox');
    const listbox = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(screen.getByText('Sessions').getAttribute('role')).toBe('presentation');
  });

  it.each([
    ['Inbox', 'goodboy:open-inbox', null],
    ['Workflows', 'goodboy:open-workflow-studio', null],
    ['Impact', 'goodboy:open-impact-studio', { scope: undefined }],
    ['Changelog', 'goodboy:open-changelog', null],
    ['Notifications', 'goodboy:open-notifications-studio', null],
    ['Workspace settings', 'goodboy:open-settings', { scope: 'workspace' }],
    ['Add workspace', 'goodboy:add-workspace', null],
  ] as const)('goes to %s through its studio event', (label, eventName, detail) => {
    hooks.currentWorkspace = { id: 'workspace-1', name: 'Harborline' };
    const listener = vi.fn();
    window.addEventListener(eventName, listener);
    render(<CommandPalette onClose={vi.fn()} initialQuery={label} />);

    fireEvent.mouseDown(screen.getByRole('option', { name: label }));

    window.removeEventListener(eventName, listener);
    const [event] = listener.mock.calls[0] ?? [];
    expect(event instanceof CustomEvent ? event.detail : 'missing').toEqual(detail);
  });

  it('lists the go to studios under one group, with board only inside a session', () => {
    hooks.currentWorkspace = { id: 'workspace-1', name: 'Harborline' };
    const { unmount } = render(<CommandPalette onClose={vi.fn()} initialQuery="board" />);
    expect(screen.queryByRole('option', { name: /back to board/i })).toBeNull();
    unmount();

    hooks.currentSession = { id: 'session-1' };
    render(<CommandPalette onClose={vi.fn()} initialQuery="board" />);
    fireEvent.mouseDown(screen.getByRole('option', { name: /back to board/i }));

    expect(state.setCurrentSession).toHaveBeenCalledWith(null);
    expect(screen.getByText('Go to').getAttribute('role')).toBe('presentation');
  });

  it('keeps workspace studios out of the palette without a workspace', () => {
    render(<CommandPalette onClose={vi.fn()} initialQuery="inbox" />);

    expect(screen.queryByRole('option', { name: 'Inbox' })).toBeNull();
  });

  it('teaches each navigation destination with the chord that reaches it', () => {
    hooks.currentSession = { id: 'session-1' };
    render(<CommandPalette onClose={vi.fn()} initialQuery="Open Agents" />);

    const row = screen.getByText('Open Agents').parentElement;
    expect(row?.textContent).toContain(shortcutGlyphs('lens.agents'));
  });
});
