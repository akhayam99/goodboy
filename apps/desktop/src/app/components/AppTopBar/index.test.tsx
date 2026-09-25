import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';

const { currentWorkspace, hooks, store } = vi.hoisted(() => {
  const workspace = {
    id: 'ws-1' as WorkspaceId,
    name: 'Harborline',
    slug: 'harborline',
    overrides: {
      defaultProviderId: null,
      defaultWorkflowId: null,
      defaultBranchPrefix: null,
      parallelEnabled: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    },
    createdAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
  } satisfies Workspace;
  return {
    currentWorkspace: workspace,
    hooks: {
      sessions: [] as ReadonlyArray<Session>,
      groups: [] as ReadonlyArray<{
        readonly key: string;
        readonly sessions: ReadonlyArray<Session>;
      }>,
      rollup: { attentionCount: 0, runningCount: 0, todaySpend: 0 },
    },
    store: {
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
      cancelScript: vi.fn(async () => undefined),
      currentWorkspaceId: workspace.id,
      projectScripts: {} as Record<string, ReadonlyArray<never>>,
      projects: [] as ReadonlyArray<never>,
      scriptRuns: {} as Record<string, never>,
      sessions: [] as ReadonlyArray<Session>,
      archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    },
  };
});

vi.mock('../../../store', () => ({
  EMPTY_ARRAY: [],
  useCurrentWorkspace: () => currentWorkspace,
  useHasUnreadElsewhere: () => false,
  useSessions: () => hooks.sessions,
  useWorkspaceRollup: () => hooks.rollup,
  useStageGroupedSessions: () => hooks.groups,
  useSessionStageInfo: () => ({ stage: 'attention', reason: 'Needs attention', attention: null }),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => <span data-testid="notification-center" />,
}));

vi.mock('../../../features/settings/components/ReportIssuePopover', () => ({
  ReportIssuePopover: () => <span data-testid="report-issue-popover" />,
}));

vi.mock('../../../features/onboarding/OnboardingCard', () => ({
  OnboardingChip: () => <span data-testid="onboarding-chip" />,
}));

beforeEach(() => {
  hooks.sessions = [];
  hooks.groups = [];
  hooks.rollup = { attentionCount: 0, runningCount: 0, todaySpend: 0 };
  store.setCurrentSession.mockClear();
});

afterEach(cleanup);

import { AppTopBar } from './index';
import type { TopBarSidebar } from './SidebarToggle';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../features/onboarding/openCommandPaletteEvent';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';

const ATTENTION_SESSION = {
  id: 'session-1' as SessionId,
  goal: 'Review the failing checks',
} as unknown as Session;

const SPEND_LABEL = 'Spent today in Harborline, counted by Goodboy. Open Impact';
const BOARD: TopBarSidebar = { hasSidebar: false, isCollapsed: false, onToggle: () => undefined };

type BarOverrides = {
  readonly onOpenSpend?: () => void;
  readonly sidebar?: TopBarSidebar;
};

const renderBar = (overrides: BarOverrides = {}) =>
  render(
    <AppTopBar
      sidebar={overrides.sidebar ?? BOARD}
      onOpenSpend={overrides.onOpenSpend ?? vi.fn()}
      onOpenScript={vi.fn()}
    />,
  );

const zones = (container: HTMLElement) =>
  Array.from(container.querySelector('[data-tauri-drag-region]')?.children ?? []);

describe('AppTopBar', () => {
  it('seats identity, command center and now in one three column grid that drags the window', () => {
    const { container } = renderBar();
    const bar = container.querySelector('[data-tauri-drag-region]');
    const children = zones(container);

    expect(bar?.getAttribute('data-tauri-drag-region')).toBe('deep');
    expect(bar?.className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)]');
    expect(bar?.className).toContain('@container/topbar');
    expect(bar?.className).toContain('pl-(--titlebar-inset)');
    expect(children.map((child) => child.className.split(' ')[0])).toEqual([
      'col-start-1',
      'col-start-2',
      'col-start-3',
    ]);
    expect(children[0]?.contains(screen.getByLabelText('Switch workspace: Harborline'))).toBe(true);
    expect(children[1]?.contains(screen.getByRole('button', { name: /^Search/ }))).toBe(true);
    expect(children[2]?.className).not.toContain('min-w-0');
  });

  it('puts the command center where the logo was, opening the palette and teaching its chord', () => {
    renderBar();
    const spy = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, spy);

    const center = screen.getByRole('button', {
      name: `Search Harborline (${shortcutGlyphs('palette.open')})`,
    });
    fireEvent.click(center);

    expect(spy).toHaveBeenCalledOnce();
    expect(center.querySelector('input')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Goodboy' })).toBeNull();
    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, spy);
  });

  it('narrows the command center on its own width and keeps the chord at every width', () => {
    renderBar();

    const center = screen.getByRole('button', { name: /^Search/ });
    expect(center.className).toContain('@min-chrome-labels/topbar:w-50');
    expect(center.className).toContain('@min-chrome-wide/topbar:w-70');
    expect(center.querySelector('kbd')?.className).not.toContain('hidden');
  });

  it('reserves the sidebar toggle slot on the board so identity never moves', () => {
    const { container } = renderBar();

    expect(screen.getByTestId('sidebar-toggle-slot')).toBeDefined();
    expect(screen.queryByRole('button', { name: /sessions \(/ })).toBeNull();
    expect(zones(container)[0]?.firstElementChild).toBe(screen.getByTestId('sidebar-toggle-slot'));
  });

  it('toggles the session sidebar from the bar, right after the traffic lights', () => {
    const onToggle = vi.fn();
    const glyph = shortcutGlyphs('column.toggle');
    const { rerender } = renderBar({
      sidebar: { hasSidebar: true, isCollapsed: false, onToggle },
    });

    fireEvent.click(screen.getByRole('button', { name: `Hide sessions (${glyph})` }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <AppTopBar
        sidebar={{ hasSidebar: true, isCollapsed: true, onToggle }}
        onOpenSpend={vi.fn()}
        onOpenScript={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: `Show sessions (${glyph})` })).toBeDefined();
  });

  it('keeps theme, the brand and a workspace gear out of the bar', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: /switch to (light|dark) mode/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Workspace settings' })).toBeNull();
    expect(screen.queryByText('Goodboy')).toBeNull();
    expect(screen.queryByRole('button', { name: /^open settings/i })).toBeNull();
    expect(screen.queryByTestId('update-indicator')).toBeNull();
  });

  it('leaves the now chip out when nothing needs you, and keeps spend', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: /need|running/ })).toBeNull();
    expect(screen.getByRole('button', { name: SPEND_LABEL })).toBeDefined();
  });

  it('opens impact only from the spend figure, never from the now chip', () => {
    hooks.groups = [
      { key: 'attention', sessions: [ATTENTION_SESSION] },
      { key: 'running', sessions: [ATTENTION_SESSION] },
    ];
    hooks.rollup = { attentionCount: 1, runningCount: 1, todaySpend: 5.04 };
    const onOpenSpend = vi.fn();
    renderBar({ onOpenSpend });

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you, 1 running' }));
    expect(onOpenSpend).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Now' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });

    const spend = screen.getByRole('button', { name: SPEND_LABEL });
    expect(spend.textContent).toContain('$5.04');
    fireEvent.click(spend);
    expect(onOpenSpend).toHaveBeenCalledOnce();
  });

  it('drops the signal words below chrome-labels, keeping counts and the spend figure', () => {
    hooks.groups = [{ key: 'running', sessions: [ATTENTION_SESSION] }];
    renderBar();

    expect(screen.getByText('running').className).toContain('@min-chrome-labels/topbar:inline');
    expect(screen.getByText('today').className).toContain('@min-chrome-labels/topbar:inline');
    expect(screen.getByText('1').className).not.toContain('hidden');
  });

  it('closes the right zone with the bell', () => {
    const { container } = renderBar();
    const right = zones(container)[2];
    const bell = screen.getByTestId('notification-center');

    expect(right?.contains(bell)).toBe(true);
    expect(right?.contains(screen.getByRole('button', { name: SPEND_LABEL }))).toBe(true);
  });

  it('leaves session breadcrumbs to the page, not the drag strip', () => {
    renderBar();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});
