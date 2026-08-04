import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';

const { currentWorkspace, hooks, store } = vi.hoisted(() => {
  const workspace = {
    id: 'ws-1' as WorkspaceId,
    name: 'Test WS',
    rootPath: '/code/test-ws',
  } as Workspace;
  return {
    currentWorkspace: workspace,
    hooks: {
      sessions: [] as ReadonlyArray<Session>,
      groups: [] as ReadonlyArray<{
        readonly key: string;
        readonly sessions: ReadonlyArray<Session>;
      }>,
      rollup: { attentionCount: 0, runningCount: 0, todaySpend: 0 },
      reasons: {} as Record<string, string>,
      attention: {} as Record<string, string | undefined>,
    },
    store: {
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
      currentWorkspaceId: workspace.id,
      workspaceScripts: {} as Record<string, ReadonlyArray<never>>,
      scriptRuns: {} as Record<string, never>,
      sessions: [] as ReadonlyArray<Session>,
    },
  };
});

vi.mock('../../../store', () => ({
  useCurrentWorkspace: () => currentWorkspace,
  useHasUnreadElsewhere: () => false,
  useSessions: () => hooks.sessions,
  useWorkspaceRollup: () => hooks.rollup,
  useStageGroupedSessions: () => hooks.groups,
  useSessionStageInfo: (session: Session) => ({
    stage: 'attention',
    reason: hooks.reasons[session.id] ?? 'Needs attention',
    attention: hooks.attention[session.id],
  }),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../../features/updater/components/UpdateIndicator', () => ({
  UpdateIndicator: () => <button type="button">Update to 0.2.0</button>,
}));

vi.mock('../../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

vi.mock('../../../features/onboarding/OnboardingCard', () => ({
  OnboardingChip: () => null,
}));

vi.mock('../../../shared/components/DogMascot', () => ({
  DogMascot: () => null,
}));

vi.mock('../../../features/session/components/SessionStripCrumbs', () => ({
  SessionStripCrumbs: () => <span>session crumbs</span>,
}));

beforeEach(() => {
  hooks.sessions = [];
  hooks.groups = [];
  hooks.rollup = { attentionCount: 0, runningCount: 0, todaySpend: 0 };
  hooks.reasons = {};
  hooks.attention = {};
  store.setCurrentSession.mockClear();
  store.setActiveLens.mockClear();
  useThemeStore.setState({ theme: 'dark' });
});

afterEach(cleanup);

import { AppTopBar } from './index';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { useThemeStore } from '../../../shared/lib/theme';

const ATTENTION_SESSION_ID = 'session-1' as SessionId;
const ATTENTION_SESSION = {
  id: ATTENTION_SESSION_ID,
  goal: 'Review the failing checks',
} as unknown as Session;

type BarOverrides = {
  readonly onOpenSettings?: () => void;
  readonly onOpenBudget?: () => void;
  readonly activeStudio?: string | null;
  readonly hasWorkspace?: boolean;
  readonly hasActiveSession?: boolean;
  readonly isSessionSidebarCollapsed?: boolean;
  readonly isSessionSidebarPeeking?: boolean;
  readonly onToggleSessionSidebar?: () => void;
  readonly onSessionSidebarAnchorEnter?: () => void;
  readonly onSessionSidebarAnchorLeave?: () => void;
};

const renderBar = (overrides: BarOverrides = {}) =>
  render(
    <AppTopBar
      onOpenSettings={overrides.onOpenSettings ?? vi.fn()}
      onOpenBudget={overrides.onOpenBudget ?? vi.fn()}
      activeStudio={overrides.activeStudio ?? null}
      hasWorkspace={overrides.hasWorkspace ?? true}
      hasActiveSession={overrides.hasActiveSession ?? false}
      isSessionSidebarCollapsed={overrides.isSessionSidebarCollapsed ?? false}
      isSessionSidebarPeeking={overrides.isSessionSidebarPeeking ?? false}
      onToggleSessionSidebar={overrides.onToggleSessionSidebar ?? vi.fn()}
      onSessionSidebarAnchorEnter={overrides.onSessionSidebarAnchorEnter ?? vi.fn()}
      onSessionSidebarAnchorLeave={overrides.onSessionSidebarAnchorLeave ?? vi.fn()}
    />,
  );

describe('AppTopBar', () => {
  it('renders settings button', () => {
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: null });
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeDefined();
  });

  it('keeps set-once preferences out of the bar, except theme', () => {
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: null });

    expect(screen.queryByRole('button', { name: /switch to (light|dark) mode/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /pair your iphone/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /getting started/i })).toBeNull();
  });

  it('flips the real theme state from the top bar', () => {
    useThemeStore.setState({ theme: 'dark' });
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: null });

    const toggle = screen.getByRole('button', { name: 'Switch to light mode' });
    fireEvent.click(toggle);

    expect(useThemeStore.getState().theme).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeDefined();
  });

  it('carries workspace identity whatever the column is doing', () => {
    const { rerender } = renderBar({ hasActiveSession: false });
    expect(screen.getByLabelText('Switch or open a workspace')).toBeDefined();

    rerender(
      <AppTopBar
        onOpenSettings={vi.fn()}
        onOpenBudget={vi.fn()}
        activeStudio={null}
        hasWorkspace
        hasActiveSession
        isSessionSidebarCollapsed={false}
        isSessionSidebarPeeking={false}
        onToggleSessionSidebar={vi.fn()}
        onSessionSidebarAnchorEnter={vi.fn()}
        onSessionSidebarAnchorLeave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Switch or open a workspace')).toBeDefined();
  });

  it('falls back to the wordmark before any workspace exists', () => {
    renderBar({ hasWorkspace: false });

    expect(screen.getByText('Goodboy')).toBeDefined();
    expect(screen.queryByLabelText('Switch or open a workspace')).toBeNull();
  });

  it('holds the column control pressed while the peek is open', () => {
    const { rerender } = renderBar({ hasActiveSession: true, isSessionSidebarCollapsed: true });
    expect(
      screen.getByRole('button', { name: /show sessions column/i }).getAttribute('aria-pressed'),
    ).toBe('false');

    rerender(
      <AppTopBar
        onOpenSettings={vi.fn()}
        onOpenBudget={vi.fn()}
        activeStudio={null}
        hasWorkspace
        hasActiveSession
        isSessionSidebarCollapsed
        isSessionSidebarPeeking
        onToggleSessionSidebar={vi.fn()}
        onSessionSidebarAnchorEnter={vi.fn()}
        onSessionSidebarAnchorLeave={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: /show sessions column/i });
    expect(toggle.className).toContain('bg-muted text-foreground');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the column control only inside a session', () => {
    const onToggleSessionSidebar = vi.fn();
    const { rerender } = renderBar({ hasActiveSession: false });
    expect(screen.queryByRole('button', { name: /sessions column/i })).toBeNull();

    rerender(
      <AppTopBar
        onOpenSettings={vi.fn()}
        onOpenBudget={vi.fn()}
        activeStudio={null}
        hasWorkspace
        hasActiveSession
        isSessionSidebarCollapsed
        isSessionSidebarPeeking={false}
        onToggleSessionSidebar={onToggleSessionSidebar}
        onSessionSidebarAnchorEnter={vi.fn()}
        onSessionSidebarAnchorLeave={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `Show sessions column (${shortcutGlyphs('column.toggle')})`,
      }),
    );
    expect(onToggleSessionSidebar).toHaveBeenCalledOnce();
  });

  it('settings button has active state when settings studio is open', () => {
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: 'settings' });
    const btn = screen.getByRole('button', { name: 'Open settings' });
    expect(btn.className).toContain('bg-foreground');
  });

  it('settings button is normal when a different studio is open', () => {
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: 'workflow' });
    const btn = screen.getByRole('button', { name: 'Open settings' });
    expect(btn.className).not.toContain('bg-foreground');
  });

  it('gives the middle to the session and keeps the update pip on the right', () => {
    const { container } = renderBar({ hasActiveSession: true });
    const update = screen.getByText('Update to 0.2.0');
    const crumbs = screen.getByText('session crumbs');
    const bar = container.querySelector('[data-tauri-drag-region]');
    const children = Array.from(bar?.children ?? []);
    const crumbIndex = children.findIndex((child) => child.contains(crumbs));
    const updateIndex = children.findIndex((child) => child.contains(update));

    expect(children[crumbIndex]?.className).toContain('flex-1');
    expect(updateIndex).toBeGreaterThan(crumbIndex);
    expect(children.some((child) => child.className.includes('absolute'))).toBe(false);
    expect(update.closest('button')).not.toBeNull();
  });

  it('leaves the middle empty on the board', () => {
    renderBar({ hasActiveSession: false });
    expect(screen.queryByText('session crumbs')).toBeNull();
  });

  it('opens budget only from the spend target and omits the beta chip', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 2.5 };
    const onOpenBudget = vi.fn();
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: onOpenBudget, activeStudio: null });

    fireEvent.click(screen.getByTitle("Today's spend across providers, open budget"));
    expect(onOpenBudget).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));
    expect(onOpenBudget).toHaveBeenCalledOnce();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('lists attention sessions and navigates from the needs-you popover', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 0 };
    hooks.reasons = { [ATTENTION_SESSION_ID]: 'PR #42: CI failed' };
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: null });

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));

    expect(screen.getByText('Needs you')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Sessions needing attention' })).toBeDefined();
    expect(screen.getByText('Review the failing checks')).toBeDefined();
    expect(screen.getByText('PR #42: CI failed')).toBeDefined();

    fireEvent.click(screen.getByTitle('Review the failing checks · PR #42: CI failed'));

    expect(store.setCurrentSession).toHaveBeenCalledWith(ATTENTION_SESSION_ID);
    expect(screen.queryByText('PR #42: CI failed')).toBeNull();
  });

  it('marks each row with the icon of its own reason, not a repeated dot', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 0 };
    hooks.reasons = { [ATTENTION_SESSION_ID]: 'PR #42: CI failed' };
    hooks.attention = { [ATTENTION_SESSION_ID]: 'ci-failed' };
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));

    const row = screen.getByTitle('Review the failing checks · PR #42: CI failed');
    const icon = row.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-danger');
    expect(row.querySelector('[class*="bg-warning"]')).toBeNull();
  });

  it('closes the needs-you dialog on Escape', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 0 };
    renderBar({ onOpenSettings: vi.fn(), onOpenBudget: vi.fn(), activeStudio: null });

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));
    expect(screen.getByRole('dialog', { name: 'Sessions needing attention' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Sessions needing attention' })).toBeNull();
  });
});
