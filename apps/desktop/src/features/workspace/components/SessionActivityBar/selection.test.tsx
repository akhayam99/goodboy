// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SessionActivityBar } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });

const GOALS = ['Split the ledger reconciliation job', 'Move templates to MJML', 'Retry webhooks'];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const sessionsOf = (goals: ReadonlyArray<string>): ReadonlyArray<Session> =>
  goals.map((goal) => aSession({ workspaceId: workspace.id, goal }));

const mount = ({
  active,
  archived = [],
}: {
  readonly active: ReadonlyArray<Session>;
  readonly archived?: ReadonlyArray<Session>;
}) => {
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [...active],
    archivedSessions: { [workspace.id]: [...archived] },
    currentWorkspaceId: workspace.id,
  });
  return render(
    <ToastProvider>
      <SessionActivityBar
        workspaceId={workspace.id}
        sessions={active}
        archivedSessions={archived}
        currentSessionId={null}
        onSelectSession={vi.fn()}
      />
    </ToastProvider>,
  );
};

const tick = (goal: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${goal}` }));

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

describe('SessionActivityBar selection bar', () => {
  it('floats one bar with the count and Select all once a checkbox is ticked', () => {
    mount({ active: sessionsOf(GOALS) });
    expect(screen.queryByRole('toolbar')).toBeNull();

    tick(GOALS[0] ?? '');

    const bar = screen.getByRole('toolbar', { name: '1 selected' });
    expect(within(bar).getByText('1 selected')).toBeDefined();
    fireEvent.click(within(bar).getByRole('button', { name: 'Select all 3' }));
    expect(screen.getByRole('toolbar', { name: '3 selected' })).toBeDefined();
  });

  it('offers Archive and Delete on live sessions, never Restore', () => {
    mount({ active: sessionsOf(GOALS) });
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');

    const labels = within(screen.getByRole('toolbar'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => /^(Archive|Restore|Delete) /.test(label));

    expect(labels).toEqual(['Archive 2 sessions', 'Delete 2 sessions']);
  });

  it('offers Restore and Delete on archived sessions and restores at once', async () => {
    const bulkUnarchiveTask = vi.fn(async (ids: ReadonlyArray<SessionId>) => ({
      succeeded: [...ids],
      failed: [],
    }));
    const archived = sessionsOf(['Old payouts spike', 'Old webhook retry']).map((session) =>
      aSession({ ...session, archivedAt: '2026-09-01T10:00:00.000Z' as IsoDateTime }),
    );
    mount({ active: [], archived });
    useAppStore.setState({ bulkUnarchiveTask });
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: workspace.id,
        patch: { isArchivedShown: true },
      });
    });
    tick('Old payouts spike');

    const bar = screen.getByRole('toolbar');
    expect(within(bar).queryByRole('button', { name: /^Archive/ })).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: 'Restore 1 session' }));

    await waitFor(() => expect(bulkUnarchiveTask).toHaveBeenCalledWith([archived[0]?.id]));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
  });

  it('confirms a delete above the bar and keeps the selection when it is cancelled', () => {
    mount({ active: sessionsOf(GOALS) });
    tick(GOALS[0] ?? '');

    fireEvent.click(
      within(screen.getByRole('toolbar')).getByRole('button', { name: 'Delete 1 session' }),
    );

    const confirm = screen.getByRole('group', { name: 'Delete 1 session?' });
    expect(within(confirm).getByText(GOALS[0] ?? '')).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Delete 1 session?' })).toBeNull();
    expect(screen.getByRole('toolbar', { name: '1 selected' })).toBeDefined();
  });

  it('selects with X and the select all key and clears with Escape', () => {
    mount({ active: sessionsOf(GOALS) });

    fireEvent.mouseOver(screen.getByText(GOALS[2] ?? ''));
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    expect(screen.getByRole('toolbar', { name: '1 selected' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA', ctrlKey: true });
    expect(screen.getByRole('toolbar', { name: '3 selected' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
