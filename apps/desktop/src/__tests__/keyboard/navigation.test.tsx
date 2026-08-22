// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      budgetAlerts: [],
      providers: [],
      skills: {},
      settings: {},
      phaseTemplates: {},
      sessionBudgets: {},
      sessionWorktrees: {},
      sessionBranches: {},
      sessionTelemetry: {},
      sessionSummary: null,
      workspaces: [],
      projects: [],
      workspaceIntegrations: {},
      newSessionDrafts: {},
      loadBudgetAlerts: vi.fn(),
      dismissBudgetAlert: vi.fn(),
      refreshProviders: vi.fn(),
      loadSkills: vi.fn(),
      saveSkill: vi.fn(),
      deleteSkill: vi.fn(),
      rescanSkills: vi.fn(),
      createSession: vi.fn(),
      setNewSessionDraft: vi.fn(),
      clearNewSessionDraft: vi.fn(),
      loadSetting: vi.fn().mockResolvedValue(null),
      saveSetting: vi.fn(),
      setSessionBudget: vi.fn(),
      loadSessionBudget: vi.fn(),
      setCurrentWorkspace: vi.fn(),
      setCurrentSession: vi.fn(),
      addWorkspace: vi.fn(),
      deleteTask: vi.fn(),
      archiveTask: vi.fn(),
      sendTurn: vi.fn(),
      cancelCurrentTurn: vi.fn(),
      hydrate: vi.fn(),
      hydrated: true,
      bootPhase: 'ready' as const,
      error: null,
    };
    return selector(state);
  }),
  useCurrentSession: vi.fn().mockReturnValue(null),
  useCurrentWorkspace: vi.fn().mockReturnValue(null),
  useWorkspaces: vi.fn().mockReturnValue([]),
  useSessions: vi.fn().mockReturnValue([]),
  useSessionSlots: vi.fn().mockReturnValue([]),
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../features/permissions/permissions', () => ({
  useEffectivePermissionRules: vi.fn().mockReturnValue([]),
  invokePermissionRuleList: vi.fn().mockResolvedValue([]),
  invokePermissionRuleUpsert: vi.fn().mockResolvedValue(undefined),
  invokePermissionRuleDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock('../../routing', () => ({
  resolveProviderForTurn: vi.fn().mockResolvedValue('anthropic'),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { DeleteSessionConfirm } from '../../features/session/components/DeleteSessionConfirm';
import { QuickCreateSession } from '../../features/session/components/QuickCreateSession';
import { QuickActionsPopover, type QuickActionItem } from '../../features/quick-actions';
import { ToastProvider } from '../../app/components/Toast';

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    workspaceId: WS_ID,
    goal: 'test goal',
    branchPrefix: 'test',
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    state: { kind: 'idle' },
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    ...overrides,
  } as Session;
}

describe('keyboard, DeleteSessionConfirm', () => {
  it('never deletes on the first keyboard reach of the panel', async () => {
    const user = userEvent.setup();
    render(<DeleteSessionConfirm session={makeSession()} onClose={vi.fn()} />);
    await user.tab();
    expect(document.activeElement?.tagName.toLowerCase()).toBe('button');
    expect(screen.getByRole('group', { name: 'Delete session?' })).toBeDefined();
  });

  it('Enter on delete button keeps it keyboard-reachable', async () => {
    const user = userEvent.setup();
    render(<DeleteSessionConfirm session={makeSession()} onClose={vi.fn()} />);
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    deleteBtn.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(deleteBtn);
  });

  it('exposes both archive and delete actions', () => {
    render(<DeleteSessionConfirm session={makeSession()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /archive instead/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDefined();
  });

  it('Tab cycles through the panel controls', async () => {
    const user = userEvent.setup();
    render(<DeleteSessionConfirm session={makeSession()} onClose={vi.fn()} />);
    await user.tab();
    const first = document.activeElement;
    await user.tab();
    const second = document.activeElement;
    expect(first).not.toBe(second);
    expect(first?.tagName.toLowerCase()).toBe('button');
    expect(second?.tagName.toLowerCase()).toBe('button');
  });
});

describe('keyboard, QuickCreateSession', () => {
  it('focuses the title input on open', () => {
    render(<QuickCreateSession workspaceId={WS_ID} onClose={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /session title/i });
    expect(document.activeElement).toBe(input);
  });

  it('dismisses on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<QuickCreateSession workspaceId={WS_ID} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('keyboard, QuickActionsPopover arrow / tab navigation', () => {
  const items: ReadonlyArray<QuickActionItem> = [
    { id: 'review', label: 'review', sublabel: 'code review', group: 'skill', perform: vi.fn() },
    { id: 'test', label: 'test', sublabel: 'run tests', group: 'skill', perform: vi.fn() },
    { id: 'deploy', label: 'deploy', sublabel: 'deploy to env', group: 'skill', perform: vi.fn() },
  ];

  it('ArrowDown advances active index and calls onSelect with Enter', () => {
    const onSelect = vi.fn();
    render(
      <QuickActionsPopover items={items} emptyHint="" onSelect={onSelect} onDismiss={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('ArrowUp wraps active index back (stays at 0 from 0)', () => {
    const onSelect = vi.fn();
    render(
      <QuickActionsPopover items={items} emptyHint="" onSelect={onSelect} onDismiss={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('Tab key selects the active item', () => {
    const onSelect = vi.fn();
    render(
      <QuickActionsPopover items={items} emptyHint="" onSelect={onSelect} onDismiss={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('Escape calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <QuickActionsPopover items={items} emptyHint="" onSelect={vi.fn()} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders empty hint when there are no items', () => {
    render(
      <QuickActionsPopover
        items={[]}
        emptyHint="nothing here"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/nothing here/i)).toBeDefined();
  });
});
