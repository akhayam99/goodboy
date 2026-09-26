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
      defaultBranchPrefix: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
      replyVoice: null,
      replyStyleNote: null,
      replyTemplateFixed: null,
      replyTemplateNoChange: null,
      resolveOnGithub: null,
      resolveCommitStyle: null,
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
      providers: [] as ReadonlyArray<never>,
      providerLimits: {},
      navigation: {},
      currentSessionId: null,
      appStudio: null,
      back: vi.fn(),
      forward: vi.fn(),
      goToHistory: vi.fn(),
      navigate: vi.fn(),
      closeStudio: vi.fn(),
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
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
  BOARD_PLACE: { at: 'board' },
}));

vi.mock('../../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => <span data-testid="notification-center" />,
}));

beforeEach(() => {
  hooks.sessions = [];
  hooks.groups = [];
  hooks.rollup = { attentionCount: 0, runningCount: 0, todaySpend: 0 };
  store.setCurrentSession.mockClear();
});

afterEach(cleanup);

import { AppTopBar } from './index';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../features/onboarding/openCommandPaletteEvent';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';

const ATTENTION_SESSION = {
  id: 'session-1' as SessionId,
  goal: 'Review the failing checks',
} as unknown as Session;

const SPEND_LABEL = 'Spent today in Harborline, counted by Goodboy. Open Impact';

type BarOverrides = {
  readonly onOpenSpend?: () => void;
};

const renderBar = (overrides: BarOverrides = {}) =>
  render(<AppTopBar onOpenSpend={overrides.onOpenSpend ?? vi.fn()} onOpenScript={vi.fn()} />);

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
    expect(bar?.className).toContain('bg-chrome');
    expect(bar?.className).not.toContain('bg-background');
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

  it('clusters Back, Forward and Board by the search, and leaves the sidebar toggle out', () => {
    const { container } = renderBar();
    const center = zones(container)[1] as HTMLElement;

    const cluster = center.querySelector('[data-nav-cluster]') as HTMLElement;
    expect(cluster).not.toBeNull();
    expect(
      cluster.compareDocumentPosition(screen.getByRole('button', { name: /^Search/ })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Board' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /sessions \(/ })).toBeNull();
  });

  it('keeps the brand and a workspace gear out of the bar', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: 'Workspace settings' })).toBeNull();
    expect(screen.queryByText('Goodboy')).toBeNull();
    expect(screen.queryByRole('button', { name: /^open settings/i })).toBeNull();
    expect(screen.queryByTestId('update-indicator')).toBeNull();
  });

  it('gives the theme its place in the bar, after the divider and before notifications', () => {
    renderBar();

    expect(screen.getByRole('button', { name: /switch to (light|dark)/i })).toBeDefined();
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

  it('closes the right zone with the bell, leaving report and setup to the Goodboy chip', () => {
    const { container } = renderBar();
    const right = zones(container)[2];
    const bell = screen.getByTestId('notification-center');

    expect(right?.lastElementChild).toBe(bell);
    expect(right?.contains(screen.getByRole('button', { name: SPEND_LABEL }))).toBe(true);
    expect(screen.queryByRole('button', { name: /report an issue/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /onboarding checklist/i })).toBeNull();
  });

  it('leaves session breadcrumbs to the page, not the drag strip', () => {
    renderBar();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});
