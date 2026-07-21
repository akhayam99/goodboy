// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, unknown>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
    sessionExternalTasks: {} as Record<string, unknown>,
    bulkUnarchiveTask: vi.fn(async () => undefined),
    bulkDeleteTask: vi.fn(async () => undefined),
    setSessionsSidebarCollapsed: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionCost: () => 0,
  useSessionHasUnread: () => false,
  useSessionStageInfo: () => ({ stage: 'done' as const, reason: 'idle' }),
  useSessionViewPrefs: () => ({ group: 'none' as const, sort: 'recent' as const }),
  useSortedGroupedSessions: (_w: unknown, sessions: ReadonlyArray<unknown>) => [
    { key: 'all', sessions },
  ],
}));

vi.mock('./SessionViewMenu', () => ({
  SessionViewMenu: () => null,
}));

vi.mock('../../../../features/providers/components/CostBadge', () => ({
  CostBadge: () => null,
}));

vi.mock('../../../../features/github/components/PullRequestChip', () => ({
  PullRequestChip: () => null,
  pullRequestMeta: () => null,
}));

import { SessionActivityBar } from './index';

const WS_ID = 'ws-1' as WorkspaceId;

function makeSession(id: string, goal: string): Session {
  return {
    id: id as SessionId,
    workspaceId: WS_ID,
    goal,
    state: { kind: 'idle', lastActivityAt: '2026-05-28T00:00:00.000Z' },
    workflowRuns: [],
  } as unknown as Session;
}

function renderBar(
  archived: ReadonlyArray<Session>,
  active: ReadonlyArray<Session> = [],
  onSelectSession: (id: SessionId) => void = vi.fn(),
) {
  return render(
    <SessionActivityBar
      workspaceId={WS_ID}
      sessions={active}
      archivedSessions={archived}
      currentSessionId={null}
      onSelectSession={onSelectSession}
      onNewSession={vi.fn()}
    />,
  );
}

function toggleArchivedTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
}

function checkboxAt(index: number): HTMLElement {
  const box = screen.getAllByRole('checkbox')[index];
  if (!box) {
    throw new Error(`no checkbox at index ${index}`);
  }
  return box;
}

function clickCheckbox(index: number): HTMLElement {
  const box = checkboxAt(index);
  fireEvent.click(box);
  return box;
}

beforeEach(() => {
  state.bulkUnarchiveTask.mockClear();
  state.bulkDeleteTask.mockClear();
  state.setSessionsSidebarCollapsed.mockClear();
  state.sessionExternalTasks = {};
});

afterEach(cleanup);

describe('SessionActivityBar, baseline', () => {
  it('renders the Sessions header and the New session button', () => {
    renderBar([]);
    expect(screen.getByText(/^Sessions$/)).toBeDefined();
    expect(screen.getByRole('button', { name: /create new session/i })).toBeDefined();
  });

  it('renders empty-state copy when no sessions in active tab', () => {
    renderBar([]);
    expect(screen.getByText(/no sessions yet/i)).toBeDefined();
  });

  it('collapses the sessions sidebar from the header button', () => {
    renderBar([]);
    fireEvent.click(screen.getByRole('button', { name: 'hide sessions' }));
    expect(state.setSessionsSidebarCollapsed).toHaveBeenCalledWith(true);
  });
});

describe('SessionActivityBar, bulk selection', () => {
  it('hides selection checkboxes in the active tab and shows them in the archived tab', () => {
    renderBar([makeSession('s-1', 'archived one')], [makeSession('a-1', 'active one')]);
    expect(screen.queryByRole('checkbox')).toBeNull();
    toggleArchivedTab();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('builds a selection from checkbox clicks and surfaces the bulk action bar with a count', () => {
    renderBar([makeSession('s-1', 'one'), makeSession('s-2', 'two')]);
    toggleArchivedTab();
    clickCheckbox(0);
    expect(screen.getByText(/1 selected/)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Restore \(1\)$/ })).toBeDefined();
  });

  it('calls bulkUnarchiveTask with the selected ids and clears the selection on Restore', async () => {
    renderBar([makeSession('s-1', 'one'), makeSession('s-2', 'two')]);
    toggleArchivedTab();
    clickCheckbox(0);
    clickCheckbox(1);
    fireEvent.click(screen.getByRole('button', { name: /^Restore \(2\)$/ }));
    expect(state.bulkUnarchiveTask).toHaveBeenCalledWith(['s-1', 's-2']);
    await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
  });

  it('opens the confirm dialog on Delete and calls bulkDeleteTask once confirmed', async () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    clickCheckbox(0);
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(1\)$/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Delete 1 sessions\?/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Delete \(1\)$/ }));
    await waitFor(() => expect(state.bulkDeleteTask).toHaveBeenCalledWith(['s-1']));
  });

  it('clears the selection when switching tabs', () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    clickCheckbox(0);
    expect(screen.getByText(/1 selected/)).toBeDefined();
    toggleArchivedTab();
    toggleArchivedTab();
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('shows no bulk action bar when nothing is selected in the archived tab', () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('toggles aria-checked and hides the bulk bar when the last selection is removed', () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    expect(checkboxAt(0).getAttribute('aria-checked')).toBe('false');
    clickCheckbox(0);
    expect(checkboxAt(0).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/1 selected/)).toBeDefined();
    clickCheckbox(0);
    expect(checkboxAt(0).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('reflects the selected count across both bulk actions when several are picked', () => {
    renderBar([makeSession('s-1', 'one'), makeSession('s-2', 'two'), makeSession('s-3', 'three')]);
    toggleArchivedTab();
    clickCheckbox(0);
    clickCheckbox(2);
    expect(screen.getByText(/2 selected/)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Restore \(2\)$/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Delete \(2\)$/ })).toBeDefined();
  });

  it('clears the selection via the Clear button', () => {
    renderBar([makeSession('s-1', 'one'), makeSession('s-2', 'two')]);
    toggleArchivedTab();
    clickCheckbox(0);
    expect(screen.getByText(/1 selected/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(state.bulkUnarchiveTask).not.toHaveBeenCalled();
    expect(state.bulkDeleteTask).not.toHaveBeenCalled();
  });

  it('lists the selected session goals in the confirm dialog', () => {
    renderBar([makeSession('s-1', 'alpha goal'), makeSession('s-2', 'beta goal')]);
    toggleArchivedTab();
    clickCheckbox(0);
    clickCheckbox(1);
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('alpha goal')).toBeDefined();
    expect(within(dialog).getByText('beta goal')).toBeDefined();
  });

  it('does not call bulkDeleteTask when the confirm dialog is cancelled', () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    clickCheckbox(0);
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(1\)$/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Cancel$/ }));
    expect(state.bulkDeleteTask).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/1 selected/)).toBeDefined();
  });

  it('opens a session on body click without toggling its selection in the archived tab', () => {
    const onSelect = vi.fn();
    renderBar([makeSession('s-1', 'open me')], [], onSelect);
    toggleArchivedTab();
    fireEvent.click(screen.getByRole('button', { name: /open me/ }));
    expect(onSelect).toHaveBeenCalledWith('s-1');
    expect(checkboxAt(0).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('clears the selection after a confirmed bulk delete', async () => {
    renderBar([makeSession('s-1', 'one')]);
    toggleArchivedTab();
    clickCheckbox(0);
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(1\)$/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Delete \(1\)$/ }));
    await waitFor(() => expect(state.bulkDeleteTask).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
  });
});

describe('SessionActivityBar, external task chip', () => {
  it('renders no external task chip when the session has no mapped task', () => {
    renderBar([], [makeSession('a-1', 'plain session')]);
    expect(screen.queryByRole('button', { name: /studio/i })).toBeNull();
  });

  it('renders the icon-variant chip and appends the identifier to the item title', () => {
    state.sessionExternalTasks = {
      'a-1': {
        sessionId: 'a-1',
        provider: 'linear',
        externalId: 'ext-1',
        identifier: 'GB-7',
        url: 'https://linear.app/x',
        title: 'mapped task',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    };
    renderBar([], [makeSession('a-1', 'active one')]);
    expect(screen.getByLabelText(/GB-7 from Linear/i)).toBeDefined();
    expect(screen.getByText('L')).toBeDefined();
    expect(screen.getByTitle(/active one · idle · GB-7/)).toBeDefined();
  });

  it('renders the matching glyph for a non-linear provider', () => {
    state.sessionExternalTasks = {
      'a-1': {
        sessionId: 'a-1',
        provider: 'sentry',
        externalId: 'ext-2',
        identifier: 'SENTRY-9',
        url: 'https://sentry.io/x',
        title: 'crash',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    };
    renderBar([], [makeSession('a-1', 'crashy')]);
    expect(screen.getByText('S')).toBeDefined();
    expect(screen.getByLabelText(/SENTRY-9 from Sentry/i)).toBeDefined();
  });
});
