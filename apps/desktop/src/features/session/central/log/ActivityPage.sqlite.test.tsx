// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  SESSION,
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { ActivityPage } from './ActivityPage';

const PAYMENTS_MOUNT = 'mock-run-mount-payments';
const RELAY_MOUNT = 'mock-run-mount-console';
const SCRIPT_ROW = /test:integration failed \(exit 2\) in payments-api/;
const RELAY_ROW = /lint passed in notify-relay/;

let useAppStore: StoryStore;

type WorkRow = {
  readonly id: string;
  readonly mountId: string;
  readonly name: string;
  readonly startedAt: number;
  readonly exitCode: number;
};

const insertWorkRow = async ({ id, mountId, name, startedAt, exitCode }: WorkRow) => {
  await storySqlite().execute(
    `INSERT INTO work_events
       (id, run_id, session_id, mount_id, agent_id, kind, started_at, ended_at, exit_code, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, 'script', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      `run-${id}`,
      SESSION_ID,
      mountId,
      startedAt,
      startedAt + 1_000,
      exitCode,
      JSON.stringify({ scriptId: name, name }),
      startedAt,
      startedAt,
    ],
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: SESSION.workspaceId, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: SESSION.workspaceId }));
  await insertWorkRow({
    id: 'w-integration',
    mountId: PAYMENTS_MOUNT,
    name: 'test:integration',
    startedAt: Date.parse('2026-11-20T10:00:00.000Z'),
    exitCode: 2,
  });
  await insertWorkRow({
    id: 'w-lint',
    mountId: RELAY_MOUNT,
    name: 'lint',
    startedAt: Date.parse('2026-11-20T10:05:00.000Z'),
    exitCode: 0,
  });
  stubStoryInvoke({
    turn_quiet: [],
    worktree_status: () => worktreeStatusOf({}),
    worktree_changed_files: { paths: [], entries: [], additions: 0, deletions: 0, numstat: '' },
  });
  const { navigate } = useAppStore.getState();
  seedActivityRunScene();
  useAppStore.setState({ navigate });
});

afterEach(cleanup);

const rowText = (pattern: RegExp) => (_content: string, element: Element | null) =>
  element?.hasAttribute('data-log-row') === true && pattern.test(element.textContent ?? '');

const findRow = (pattern: RegExp) => screen.findByText(rowText(pattern));

const queryRow = (pattern: RegExp) => screen.queryByText(rowText(pattern));

const renderActivity = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <ActivityPage session={SESSION} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

const runRowCount = (): number => document.querySelectorAll('[data-row-id^="run:"]').length;

describe('the Activity page', () => {
  it('keeps the timeline rows of the log and adds the script runs read from work_events', async () => {
    renderActivity();

    expect(await findRow(SCRIPT_ROW)).toBeDefined();
    expect(queryRow(RELAY_ROW)).not.toBeNull();
    expect(runRowCount()).toBeGreaterThan(1);
  });

  it('shows only script runs under Scripts and gives the rest back under All', async () => {
    renderActivity();
    await findRow(SCRIPT_ROW);
    const runs = runRowCount();
    const kinds = screen.getByRole('combobox', { name: 'Show activity of one kind' });

    fireEvent.click(kinds);
    fireEvent.click(await screen.findByRole('option', { name: 'Scripts' }));

    await waitFor(() => expect(runRowCount()).toBe(0));
    expect(queryRow(SCRIPT_ROW)).not.toBeNull();

    fireEvent.click(kinds);
    fireEvent.click(await screen.findByRole('option', { name: 'All' }));

    await waitFor(() => expect(runRowCount()).toBe(runs));
  });

  it('filters by project through the mount id of each row', async () => {
    renderActivity();
    await findRow(RELAY_ROW);

    fireEvent.click(screen.getByRole('button', { name: 'Filter activity by project' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'notify-relay' }));

    await waitFor(() => expect(queryRow(SCRIPT_ROW)).toBeNull());
    expect(queryRow(RELAY_ROW)).not.toBeNull();
  });

  it('says when work_events cannot be read, keeps the log, and Retry reads it again', async () => {
    injectDbFault({ match: /FROM work_events/ });
    renderActivity();

    expect(await screen.findByText("Couldn't load scripts and commands")).toBeDefined();
    expect(queryRow(SCRIPT_ROW)).toBeNull();
    expect(runRowCount()).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await findRow(SCRIPT_ROW)).toBeDefined();
    expect(screen.queryByText("Couldn't load scripts and commands")).toBeNull();
  });
});
