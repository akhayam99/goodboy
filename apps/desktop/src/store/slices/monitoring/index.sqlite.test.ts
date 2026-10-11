import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting, insertWorkspace } from '@goodboy/db';
import type { LedgerRow, MonitorSnapshot } from '@goodboy/core';
import { nextProjectId, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { selectLeftovers } from './selectLeftovers';
import { selectPortRows } from './selectPortRows';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const LEDGER_CORE = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/work/ledger-core',
});
const NOTIFY_RELAY = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'notify-relay',
  rootPath: '/work/notify-relay',
  starredAt: TEST_NOW,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [LEDGER_CORE, NOTIFY_RELAY],
  });
});

const snapshotAt = ({
  takenAt,
  listeners = [],
  processes = [],
}: {
  readonly takenAt: number;
  readonly listeners?: MonitorSnapshot['listeners'];
  readonly processes?: MonitorSnapshot['processes'];
}): MonitorSnapshot => ({ listeners, processes, takenAt, platformSupported: true });

const processAt = ({ pid, cwd, pgid = pid }: { pid: number; cwd: string; pgid?: number }) => ({
  pid,
  ppid: 1,
  pgid,
  name: 'node',
  cwd,
  startedAt: 0,
  cpuPercent: 0,
  rssBytes: 0,
  uid: 501,
  argsMasked: '',
});

const scriptEntry = (pid: number): LedgerRow => ({
  spawnId: `script-${pid}`,
  kind: 'script',
  pid,
  pgid: pid,
  sessionId: null,
  mountPath: null,
  cwd: LEDGER_CORE.rootPath,
  startedAt: 0,
});

const snapshotCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'monitor_snapshot').length;

describe('refreshMonitorSnapshot', () => {
  it('runs one snapshot for overlapping calls and stores snapshot and ledger', async () => {
    let release: (value: MonitorSnapshot) => void = () => undefined;
    stubStoryInvoke({
      monitor_snapshot: () =>
        new Promise<MonitorSnapshot>((resolve) => {
          release = resolve;
        }),
      process_ledger_list: [scriptEntry(10)],
    });

    const first = useAppStore.getState().refreshMonitorSnapshot();
    const second = useAppStore.getState().refreshMonitorSnapshot();
    release(snapshotAt({ takenAt: 100 }));
    await Promise.all([first, second]);

    expect(snapshotCalls()).toBe(1);
    expect(useAppStore.getState().monitorSnapshot?.takenAt).toBe(100);
    expect(useAppStore.getState().monitorLedger).toHaveLength(1);
    expect(useAppStore.getState().monitorError).toBeNull();
  });

  it('takes a new snapshot once the previous call finished', async () => {
    stubStoryInvoke({ monitor_snapshot: snapshotAt({ takenAt: 1 }), process_ledger_list: [] });
    await useAppStore.getState().refreshMonitorSnapshot();
    await useAppStore.getState().refreshMonitorSnapshot();
    expect(snapshotCalls()).toBe(2);
  });

  it('never lets an older result replace a newer one', async () => {
    stubStoryInvoke({ monitor_snapshot: snapshotAt({ takenAt: 200 }), process_ledger_list: [] });
    await useAppStore.getState().refreshMonitorSnapshot();
    stubStoryInvoke({ monitor_snapshot: snapshotAt({ takenAt: 100 }), process_ledger_list: [] });
    await useAppStore.getState().refreshMonitorSnapshot();

    expect(useAppStore.getState().monitorSnapshot?.takenAt).toBe(200);
  });

  it('keeps the old snapshot and shows the error when the command fails', async () => {
    stubStoryInvoke({ monitor_snapshot: snapshotAt({ takenAt: 5 }), process_ledger_list: [] });
    await useAppStore.getState().refreshMonitorSnapshot();
    stubStoryInvoke({
      monitor_snapshot: () => Promise.reject(new Error('lsof timed out')),
      process_ledger_list: [],
    });
    await useAppStore.getState().refreshMonitorSnapshot();

    expect(useAppStore.getState().monitorSnapshot?.takenAt).toBe(5);
    expect(useAppStore.getState().monitorError).toContain('lsof timed out');
  });

  it('learns a port a Goodboy script held, per project, and persists it', async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotAt({
        takenAt: 1,
        listeners: [{ port: 5005, address: '*', protocol: 'tcp', pid: 10 }],
        processes: [processAt({ pid: 10, cwd: LEDGER_CORE.rootPath })],
      }),
      process_ledger_list: [scriptEntry(10)],
    });
    await useAppStore.getState().refreshMonitorSnapshot();

    expect(useAppStore.getState().monitorLearned).toEqual({ [LEDGER_CORE.id]: [5005] });
    expect(await getSetting(storySqlite(), `monitor.learnedPorts.${LEDGER_CORE.id}`)).toBe(
      '[5005]',
    );
  });
});

describe('watchPort and unwatchPort', () => {
  const key = `monitor.watchedPorts.${LEDGER_CORE.id}`;

  it('persists a watched port and applies it to the store', async () => {
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 4000 });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 3000 });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 3000 });

    expect(useAppStore.getState().monitorWatched[LEDGER_CORE.id]).toEqual([3000, 4000]);
    expect(await getSetting(storySqlite(), key)).toBe('[3000,4000]');
  });

  it('keeps both ports when two watches run at once', async () => {
    await Promise.all([
      useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 3000 }),
      useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 4000 }),
    ]);

    expect(await getSetting(storySqlite(), key)).toBe('[3000,4000]');
  });

  it('refuses a port outside 1 to 65535 and an unknown project', async () => {
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 0 });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 65536 });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 80.5 });
    await useAppStore.getState().watchPort({ projectId: nextProjectId(), port: 3000 });

    expect(useAppStore.getState().monitorWatched).toEqual({});
    expect(await getSetting(storySqlite(), key)).toBeNull();
  });

  it('unwatches a port in the row and in the store', async () => {
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 3000 });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 4000 });
    await useAppStore.getState().unwatchPort({ projectId: LEDGER_CORE.id, port: 3000 });

    expect(useAppStore.getState().monitorWatched[LEDGER_CORE.id]).toEqual([4000]);
    expect(await getSetting(storySqlite(), key)).toBe('[4000]');
  });

  it('leaves the old state and reports when the write fails', async () => {
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 3000 });
    injectDbFault({ match: /INSERT INTO settings/, message: 'disk full' });
    await useAppStore.getState().watchPort({ projectId: LEDGER_CORE.id, port: 4000 });

    expect(useAppStore.getState().monitorWatched[LEDGER_CORE.id]).toEqual([3000]);
    const errors = await rowsOf<{ title: string }>({
      sql: "SELECT title FROM notifications WHERE kind = 'error'",
    });
    expect(errors.map((row) => row.title)).toContain("Couldn't watch the port");
  });
});

describe('loadWatchedPorts', () => {
  it('loads the scan, the watched set and the learned set per project', async () => {
    const db = await openStorySqlite();
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
      `monitor.watchedPorts.${LEDGER_CORE.id}`,
      '[3000, "x", 99999]',
      1,
    ]);
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
      `monitor.learnedPorts.${LEDGER_CORE.id}`,
      '[5005]',
      1,
    ]);
    stubStoryInvoke({
      monitor_watched_ports: ({ projectRoot }: { projectRoot: string }) =>
        projectRoot === LEDGER_CORE.rootPath
          ? [{ port: 5173, label: 'dev', source: 'script' }]
          : [],
    });

    await useAppStore.getState().loadWatchedPorts();

    const state = useAppStore.getState();
    expect(state.monitorScanned[LEDGER_CORE.id]).toEqual([
      { port: 5173, label: 'dev', source: 'script' },
    ]);
    expect(state.monitorWatched[LEDGER_CORE.id]).toEqual([3000]);
    expect(state.monitorLearned[LEDGER_CORE.id]).toEqual([5005]);
    expect(state.monitorScanned[NOTIFY_RELAY.id]).toEqual([]);
  });
});

describe('selectors', () => {
  it('lists starred projects first and merges scan, user and learned ports', async () => {
    useAppStore.setState({
      monitorSnapshot: snapshotAt({ takenAt: 1 }),
      monitorScanned: { [LEDGER_CORE.id]: [{ port: 1000, label: 'dev', source: 'script' }] },
      monitorWatched: { [NOTIFY_RELAY.id]: [9000] },
      monitorLearned: { [LEDGER_CORE.id]: [500] },
    });

    const rows = selectPortRows(useAppStore.getState());

    expect(rows.map((row) => [row.projectId, row.port, row.state])).toEqual([
      [NOTIFY_RELAY.id, 9000, 'free'],
      [LEDGER_CORE.id, 500, 'free'],
      [LEDGER_CORE.id, 1000, 'free'],
    ]);
  });

  it('returns no rows before the first snapshot and the same array for the same input', () => {
    expect(selectPortRows(useAppStore.getState())).toEqual([]);
    useAppStore.setState({ monitorSnapshot: snapshotAt({ takenAt: 1 }) });
    const state = useAppStore.getState();
    expect(selectPortRows(state)).toBe(selectPortRows(state));
  });

  it('reports a group whose leader left the process table as a leftover', () => {
    useAppStore.setState({
      monitorSnapshot: snapshotAt({
        takenAt: 1,
        processes: [processAt({ pid: 11, pgid: 10, cwd: LEDGER_CORE.rootPath })],
      }),
      monitorLedger: [scriptEntry(10)],
    });

    const leftovers = selectLeftovers(useAppStore.getState());

    expect(leftovers.map((item) => item.spawnId)).toEqual(['script-10']);
    expect(selectLeftovers({ monitorSnapshot: null, monitorLedger: [] })).toEqual([]);
  });
});
