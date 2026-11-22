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
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useWorkEvents } from './index';

const SESSION = aSession({ goal: 'Round the ledger' });
const SESSION_ID = SESSION.id;
const SCRIPT_ID = 'discovered:payments-api:dev';
const STARTED_AT = Date.parse('2026-11-20T10:00:00.000Z');
const STOPPED_EXIT_CODE = 143;

let useAppStore: StoryStore;

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const deferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  const promise = new Promise<void>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

type RunParams = {
  readonly runId: string;
};

const saveStart = async ({ runId }: RunParams) => {
  await storySqlite().execute(
    `INSERT INTO work_events
       (id, run_id, session_id, mount_id, agent_id, kind, started_at, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, 'script', ?, '{"name":"dev"}', ?, ?)`,
    [`work-${runId}`, runId, SESSION_ID, STARTED_AT, STARTED_AT, STARTED_AT],
  );
};

const saveEnd = async ({ runId }: RunParams) => {
  await storySqlite().execute(
    'UPDATE work_events SET ended_at = ?, exit_code = ? WHERE run_id = ?',
    [STARTED_AT + 1_000, STOPPED_EXIT_CODE, runId],
  );
};

type ExitPayload = {
  readonly runId: string;
  readonly exitCode: number;
};

const emitExit = ({ runId, exitCode }: ExitPayload) => {
  const call = vi.mocked(listen).mock.calls.find(([name]) => name === 'script-exit');
  if (call === undefined) {
    throw new Error('nothing listens to script-exit');
  }
  const [, handler] = call;
  void handler({ event: 'script-exit', id: 0, payload: { runId, exitCode } });
};

const runIdNow = (): string =>
  useAppStore.getState().scriptRuns[SESSION_ID]?.[SCRIPT_ID]?.runId ?? '';

const eventsNow = () => useAppStore.getState().workEvents[SESSION_ID];

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
  await insertSession(db, SESSION);
});

afterEach(cleanup);

describe('useWorkEvents', () => {
  it('reads again once the start went through and once a stopped run exits', async () => {
    const launch = deferred();
    stubStoryInvoke({
      workspace_script_run_adhoc: async ({ runId }: RunParams) => {
        await launch.promise;
        await saveStart({ runId });
        return runId;
      },
      workspace_script_cancel: null,
    });
    const { result } = renderHook(() => useWorkEvents({ sessionId: SESSION_ID }));
    await waitFor(() => expect(eventsNow()).toEqual([]));
    const beforeStart = eventsNow();

    void useAppStore.getState().runDiscoveredScript({
      sessionId: SESSION_ID,
      scriptId: SCRIPT_ID,
      name: 'dev',
      command: 'pnpm run dev',
      cwd: '~/code/harborline/payments-api',
    });
    await waitFor(() => expect(eventsNow()).not.toBe(beforeStart));
    expect(result.current.events).toEqual([]);

    launch.resolve();
    await waitFor(() =>
      expect(result.current.events.map((event) => event.runId)).toEqual([runIdNow()]),
    );
    expect(result.current.events[0]?.endedAt).toBeNull();

    const runId = runIdNow();
    const beforeStop = eventsNow();
    await useAppStore.getState().cancelScript(SESSION_ID, SCRIPT_ID);
    await waitFor(() => expect(eventsNow()).not.toBe(beforeStop));
    expect(result.current.events[0]?.exitCode).toBeNull();

    await saveEnd({ runId });
    emitExit({ runId, exitCode: STOPPED_EXIT_CODE });

    await waitFor(() => expect(result.current.events[0]?.exitCode).toBe(STOPPED_EXIT_CODE));
  });
});
