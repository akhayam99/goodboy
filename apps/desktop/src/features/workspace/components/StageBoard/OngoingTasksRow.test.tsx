// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  listWorkspaceExternalTasks: vi.fn(),
  deleteWorkspaceExternalTask: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listWorkspaceExternalTasks: h.listWorkspaceExternalTasks,
    deleteWorkspaceExternalTask: h.deleteWorkspaceExternalTask,
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  IsoDateTime,
  SessionExternalTask,
  SessionId,
  WorkspaceExternalTask,
  WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { OngoingTasksRow } from './OngoingTasksRow';
import { sessionsOnOngoingTask } from './sessionsOnOngoingTask';

const WORKSPACE = 'harborline' as WorkspaceId;
const NOW = '2026-10-02T09:00:00.000Z' as IsoDateTime;

const REVAMP: WorkspaceExternalTask = {
  workspaceId: WORKSPACE,
  provider: 'linear',
  externalId: 'lin-400',
  identifier: 'HAR-400',
  url: 'https://linear.app/harborline/issue/HAR-400',
  title: 'Payments revamp',
  createdAt: NOW,
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.listWorkspaceExternalTasks.mockReset();
  h.deleteWorkspaceExternalTask.mockClear();
});

afterEach(cleanup);

describe('OngoingTasksRow', () => {
  it('says how to fill it while the workspace tracks nothing', async () => {
    h.listWorkspaceExternalTasks.mockResolvedValue([]);
    render(<OngoingTasksRow workspaceId={WORKSPACE} filter={null} onFilter={vi.fn()} />);

    await waitFor(() => expect(h.listWorkspaceExternalTasks).toHaveBeenCalled());
    expect(
      within(screen.getByRole('group', { name: 'Ongoing' })).getByText(
        'Nothing ongoing. Link a task to the whole workspace.',
      ).tagName,
    ).toBe('SPAN');
  });

  it('filters the board on a chip, and clears it on a second click', async () => {
    h.listWorkspaceExternalTasks.mockResolvedValue([REVAMP]);
    const onFilter = vi.fn();
    const { rerender } = render(
      <OngoingTasksRow workspaceId={WORKSPACE} filter={null} onFilter={onFilter} />,
    );

    const chip = await screen.findByRole('button', { name: /Payments revamp/ });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(onFilter).toHaveBeenLastCalledWith('linear:lin-400');

    rerender(
      <OngoingTasksRow workspaceId={WORKSPACE} filter="linear:lin-400" onFilter={onFilter} />,
    );
    expect(
      screen.getByRole('button', { name: /Payments revamp/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });

  it('stops tracking a task and drops its filter', async () => {
    h.listWorkspaceExternalTasks.mockResolvedValueOnce([REVAMP]).mockResolvedValue([]);
    const onFilter = vi.fn();
    render(<OngoingTasksRow workspaceId={WORKSPACE} filter="linear:lin-400" onFilter={onFilter} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Stop tracking HAR-400' }));

    await waitFor(() =>
      expect(h.deleteWorkspaceExternalTask).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WORKSPACE, externalId: 'lin-400' }),
      ),
    );
    expect(onFilter).toHaveBeenCalledWith(null);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Stop tracking HAR-400' })).toBeNull(),
    );
  });
});

describe('sessionsOnOngoingTask', () => {
  const link = (sessionId: string, externalId: string): SessionExternalTask => ({
    sessionId: sessionId as SessionId,
    provider: 'linear',
    externalId,
    identifier: externalId.toUpperCase(),
    url: '',
    title: '',
    createdAt: NOW,
  });

  it('keeps the sessions that link the task in any scope', () => {
    expect(
      sessionsOnOngoingTask({
        filter: 'linear:lin-400',
        sessionExternalTasks: {
          's-retry': [
            link('s-retry', 'lin-212'),
            { ...link('s-retry', 'lin-400'), scope: 'branch', branch: 'hl/a' },
          ],
          's-copy': [link('s-copy', 'lin-231')],
          's-ledger': [link('s-ledger', 'lin-400')],
        },
      }),
    ).toEqual(['s-retry', 's-ledger']);
  });

  it('selects nothing without a filter', () => {
    expect(
      sessionsOnOngoingTask({ filter: null, sessionExternalTasks: { 's-a': [link('s-a', 'x')] } }),
    ).toEqual([]);
  });
});
