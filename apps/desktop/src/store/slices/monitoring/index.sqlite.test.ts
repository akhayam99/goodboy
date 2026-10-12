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
}): MonitorSnapshot => ({ listeners, processes, takenAt, isPlatformSupported: true });

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

const PINNED_KEY = 'monitor.pinnedPorts';
const HIDDEN_KEY = 'monitor.hiddenPorts';

const putSetting = async ({ key, value }: { readonly key: string; readonly value: string }) => {
  await storySqlite().execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
    key,
    value,
    1,
  ]);
};

describe('pinPort and unpinPort', () => {
  it('persists a pinned port with its description and applies it to the store', async () => {
    await useAppStore.getState().pinPort({ port: 4000, description: ' Mock  API ' });
    await useAppStore.getState().pinPort({ port: 3000, description: '' });
    await useAppStore.getState().pinPort({ port: 3000, description: '' });

    expect(useAppStore.getState().monitorPinned).toEqual([
      { port: 3000, description: '' },
      { port: 4000, description: 'Mock API' },
    ]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe(
      '[{"port":3000,"description":""},{"port":4000,"description":"Mock API"}]',
    );
  });

  it('edits the description of a port that is already pinned', async () => {
    await useAppStore.getState().pinPort({ port: 3000, description: 'Docs' });
    await useAppStore.getState().pinPort({ port: 3000, description: 'Docs site' });

    expect(useAppStore.getState().monitorPinned).toEqual([
      { port: 3000, description: 'Docs site' },
    ]);
  });

  it('cuts a description to 60 characters', async () => {
    await useAppStore.getState().pinPort({ port: 3000, description: 'x'.repeat(90) });

    expect(useAppStore.getState().monitorPinned[0]?.description).toHaveLength(60);
  });

  it('keeps both ports when two pins run at once', async () => {
    await Promise.all([
      useAppStore.getState().pinPort({ port: 3000, description: 'a' }),
      useAppStore.getState().pinPort({ port: 4000, description: 'b' }),
    ]);

    expect(useAppStore.getState().monitorPinned.map((pin) => pin.port)).toEqual([3000, 4000]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe(
      '[{"port":3000,"description":"a"},{"port":4000,"description":"b"}]',
    );
  });

  it('refuses a port outside 1 to 65535', async () => {
    await useAppStore.getState().pinPort({ port: 0, description: '' });
    await useAppStore.getState().pinPort({ port: 65536, description: '' });
    await useAppStore.getState().pinPort({ port: 80.5, description: '' });

    expect(useAppStore.getState().monitorPinned).toEqual([]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBeNull();
  });

  it('unpins a port in the row and in the store, with an Undo that pins it back', async () => {
    await useAppStore.getState().pinPort({ port: 3000, description: 'Docs' });
    await useAppStore.getState().pinPort({ port: 4000, description: '' });
    await useAppStore.getState().unpinPort({ port: 3000 });

    expect(useAppStore.getState().monitorPinned).toEqual([{ port: 4000, description: '' }]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe('[{"port":4000,"description":""}]');

    await useAppStore.getState().undoLastOperation({});

    expect(useAppStore.getState().monitorPinned).toEqual([
      { port: 3000, description: 'Docs' },
      { port: 4000, description: '' },
    ]);
  });

  it('discards the Undo of an unpin when the port was pinned again meanwhile', async () => {
    await useAppStore.getState().pinPort({ port: 3000, description: 'Docs' });
    await useAppStore.getState().unpinPort({ port: 3000 });
    await useAppStore.getState().pinPort({ port: 3000, description: 'Billing' });

    await useAppStore.getState().undoLastOperation({});

    expect(useAppStore.getState().monitorPinned).toEqual([{ port: 3000, description: 'Billing' }]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe(
      '[{"port":3000,"description":"Billing"}]',
    );
  });

  it('leaves the old state and reports when the write fails', async () => {
    await useAppStore.getState().pinPort({ port: 3000, description: '' });
    injectDbFault({ match: /INSERT INTO settings/, message: 'disk full' });
    await useAppStore.getState().pinPort({ port: 4000, description: '' });

    expect(useAppStore.getState().monitorPinned).toEqual([{ port: 3000, description: '' }]);
    const errors = await rowsOf<{ title: string }>({
      sql: "SELECT title FROM notifications WHERE kind = 'error'",
    });
    expect(errors.map((row) => row.title)).toContain("Couldn't pin the port");
  });
});

describe('hidePort, unhidePort and showHiddenPorts', () => {
  it('hides a port at once, persists it and offers an Undo', async () => {
    await useAppStore.getState().hidePort({ port: 5173, source: 'workspace' });
    await useAppStore.getState().hidePort({ port: 5173, source: 'workspace' });

    expect(useAppStore.getState().monitorHidden).toEqual([{ port: 5173, source: 'workspace' }]);
    expect(await getSetting(storySqlite(), HIDDEN_KEY)).toBe(
      '[{"port":5173,"source":"workspace"}]',
    );

    await useAppStore.getState().undoLastOperation({});

    expect(useAppStore.getState().monitorHidden).toEqual([]);
  });

  it('discards the Undo of a hide after Show all and a newer hide of the same port', async () => {
    await useAppStore.getState().hidePort({ port: 5173, source: 'workspace' });
    const staleId = useAppStore.getState().undoStack[0]?.id;
    await useAppStore.getState().showHiddenPorts();
    await useAppStore.getState().hidePort({ port: 5173, source: 'workspace' });

    await useAppStore.getState().undoLastOperation({ id: staleId });

    expect(useAppStore.getState().monitorHidden).toEqual([{ port: 5173, source: 'workspace' }]);
    expect(await getSetting(storySqlite(), HIDDEN_KEY)).toBe(
      '[{"port":5173,"source":"workspace"}]',
    );
  });

  it('keeps the same port hidden from one layer and visible in the other', async () => {
    await useAppStore.getState().hidePort({ port: 3000, source: 'workspace' });
    await useAppStore.getState().hidePort({ port: 3000, source: 'goodboy' });
    await useAppStore.getState().unhidePort({ port: 3000, source: 'workspace' });

    expect(useAppStore.getState().monitorHidden).toEqual([{ port: 3000, source: 'goodboy' }]);
  });

  it('shows everything again in one step', async () => {
    await useAppStore.getState().hidePort({ port: 3000, source: 'workspace' });
    await useAppStore.getState().hidePort({ port: 4000, source: 'goodboy' });
    await useAppStore.getState().showHiddenPorts();

    expect(useAppStore.getState().monitorHidden).toEqual([]);
    expect(await getSetting(storySqlite(), HIDDEN_KEY)).toBe('[]');
  });

  it('refuses an invalid port and reports a failed write', async () => {
    await useAppStore.getState().hidePort({ port: 0, source: 'goodboy' });
    expect(useAppStore.getState().monitorHidden).toEqual([]);

    injectDbFault({ match: /INSERT INTO settings/, message: 'disk full' });
    await useAppStore.getState().hidePort({ port: 3000, source: 'goodboy' });

    expect(useAppStore.getState().monitorHidden).toEqual([]);
    const errors = await rowsOf<{ title: string }>({
      sql: "SELECT title FROM notifications WHERE kind = 'error'",
    });
    expect(errors.map((row) => row.title)).toContain("Couldn't hide the port");
  });
});

describe('loadWatchedPorts', () => {
  const scanStub = () =>
    stubStoryInvoke({
      monitor_watched_ports: ({ projectRoot }: { projectRoot: string }) =>
        projectRoot === LEDGER_CORE.rootPath
          ? [{ port: 5173, label: 'dev', source: 'script', relDir: '' }]
          : [],
    });

  it('loads the scan, the learned set per project and the global pins and hidden list', async () => {
    await putSetting({
      key: PINNED_KEY,
      value: '[{"port":3000,"description":"Docs"},{"port":"x"},{"port":99999,"description":"no"}]',
    });
    await putSetting({
      key: HIDDEN_KEY,
      value: '[{"port":5173,"source":"workspace"},{"port":1,"source":"mac"}]',
    });
    await putSetting({ key: `monitor.learnedPorts.${LEDGER_CORE.id}`, value: '[5005]' });
    scanStub();

    await useAppStore.getState().loadWatchedPorts();

    const state = useAppStore.getState();
    expect(state.monitorScanned[LEDGER_CORE.id]).toEqual([
      { port: 5173, label: 'dev', source: 'script', relDir: '' },
    ]);
    expect(state.monitorLearned[LEDGER_CORE.id]).toEqual([5005]);
    expect(state.monitorScanned[NOTIFY_RELAY.id]).toEqual([]);
    expect(state.monitorPinned).toEqual([{ port: 3000, description: 'Docs' }]);
    expect(state.monitorHidden).toEqual([{ port: 5173, source: 'workspace' }]);
  });

  it('folds the old per-project watches into the pins once and deletes the old keys', async () => {
    await putSetting({
      key: `monitor.watchedPorts.${LEDGER_CORE.id}`,
      value: '[3000, "x", 99999]',
    });
    await putSetting({ key: `monitor.watchedPorts.${NOTIFY_RELAY.id}`, value: '[3000, 9000]' });
    await putSetting({ key: PINNED_KEY, value: '[{"port":9000,"description":"Queue"}]' });
    await putSetting({ key: `monitor.learnedPorts.${LEDGER_CORE.id}`, value: '[5005]' });
    scanStub();

    await useAppStore.getState().loadWatchedPorts();

    expect(useAppStore.getState().monitorPinned).toEqual([
      { port: 3000, description: '' },
      { port: 9000, description: 'Queue' },
    ]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe(
      '[{"port":3000,"description":""},{"port":9000,"description":"Queue"}]',
    );
    expect(await getSetting(storySqlite(), `monitor.watchedPorts.${LEDGER_CORE.id}`)).toBeNull();
    expect(await getSetting(storySqlite(), `monitor.watchedPorts.${NOTIFY_RELAY.id}`)).toBeNull();
    expect(await getSetting(storySqlite(), `monitor.learnedPorts.${LEDGER_CORE.id}`)).toBe(
      '[5005]',
    );
  });

  it('does not fold anything a second time and keeps a pin the user removed', async () => {
    await putSetting({ key: `monitor.watchedPorts.${LEDGER_CORE.id}`, value: '[3000]' });
    scanStub();
    await useAppStore.getState().loadWatchedPorts();
    await useAppStore.getState().unpinPort({ port: 3000 });

    await useAppStore.getState().loadWatchedPorts();

    expect(useAppStore.getState().monitorPinned).toEqual([]);
    expect(await getSetting(storySqlite(), PINNED_KEY)).toBe('[]');
  });

  it('folds the watches of a project that is no longer connected', async () => {
    const gone = buildStoryProject({
      id: nextProjectId(),
      workspaceId: WORKSPACE_ID,
      name: 'payments-api',
      rootPath: '/work/payments-api',
      disconnectedAt: TEST_NOW,
    });
    useAppStore.setState({ projects: [LEDGER_CORE, NOTIFY_RELAY, gone] });
    await putSetting({ key: `monitor.watchedPorts.${gone.id}`, value: '[7000]' });
    scanStub();

    await useAppStore.getState().loadWatchedPorts();

    expect(useAppStore.getState().monitorPinned).toEqual([{ port: 7000, description: '' }]);
  });
});

describe('selectors', () => {
  it('lists starred projects first and merges scanned and learned ports with their source', async () => {
    useAppStore.setState({
      monitorSnapshot: snapshotAt({ takenAt: 1 }),
      monitorScanned: {
        [LEDGER_CORE.id]: [{ port: 1000, label: 'dev', source: 'script', relDir: '' }],
        [NOTIFY_RELAY.id]: [{ port: 9000, label: 'queue', source: 'compose', relDir: '' }],
      },
      monitorLearned: { [LEDGER_CORE.id]: [500] },
    });

    const rows = selectPortRows(useAppStore.getState());

    expect(rows.map((row) => [row.projectId, row.port, row.state, row.source])).toEqual([
      [NOTIFY_RELAY.id, 9000, 'free', 'compose'],
      [LEDGER_CORE.id, 500, 'free', 'learned'],
      [LEDGER_CORE.id, 1000, 'free', 'script'],
    ]);
  });

  it('ignores pins, which are global and not tied to a project', async () => {
    useAppStore.setState({
      monitorSnapshot: snapshotAt({ takenAt: 1 }),
      monitorPinned: [{ port: 3000, description: 'Docs' }],
    });

    expect(selectPortRows(useAppStore.getState())).toEqual([]);
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
