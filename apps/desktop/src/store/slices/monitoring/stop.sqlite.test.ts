import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LedgerRow, MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();
const WORKTREE = '/work/worktrees/hl-fix-duplicate-credit/payments-api';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const processOf = ({ pid, pgid = pid }: { readonly pid: number; readonly pgid?: number }) =>
  ({
    pid,
    ppid: 1,
    pgid,
    name: 'next-server',
    cwd: WORKTREE,
    startedAt: 1,
    cpuPercent: 0,
    rssBytes: 0,
    uid: 501,
    argsMasked: '',
  }) satisfies MonitorProcess;

const snapshotOf = ({
  processes,
}: {
  readonly processes: ReadonlyArray<MonitorProcess>;
}): MonitorSnapshot => ({ listeners: [], processes, takenAt: 1, isPlatformSupported: true });

const scriptEntry = ({ pid }: { readonly pid: number }): LedgerRow => ({
  spawnId: `script-${pid}`,
  kind: 'script',
  pid,
  pgid: pid,
  sessionId: SESSION_ID,
  mountPath: null,
  cwd: WORKTREE,
  startedAt: 1,
});

const callsTo = (command: string) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

describe('stopGoodboyRow', () => {
  it("stops a script through the script's own cancel, never through monitor_stop", async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [processOf({ pid: 10 })] }),
      process_ledger_list: [scriptEntry({ pid: 10 })],
      workspace_script_cancel: null,
    });
    useAppStore.setState({
      monitorLedger: [scriptEntry({ pid: 10 })],
      scriptRuns: {
        [SESSION_ID]: { dev: { status: 'pending', result: null, runId: 'run-1', startedAt: 1 } },
      },
    });

    await useAppStore.getState().stopGoodboyRow({ spawnId: 'script-10' });

    expect(callsTo('workspace_script_cancel')).toEqual([
      ['workspace_script_cancel', { runId: 'run-1' }],
    ]);
    expect(callsTo('monitor_stop')).toEqual([]);
    expect(useAppStore.getState().scriptRuns[SESSION_ID]?.['dev']?.status).toBe('cancelled');
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('falls back to monitor_stop for a Goodboy process nothing in the app owns', async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [processOf({ pid: 10 })] }),
      process_ledger_list: [scriptEntry({ pid: 10 })],
      monitor_stop: { outcome: 'stopped', reason: null },
    });
    useAppStore.setState({ monitorLedger: [scriptEntry({ pid: 10 })], scriptRuns: {} });

    await useAppStore.getState().stopGoodboyRow({ spawnId: 'script-10' });

    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 10, force: false }]]);
  });
});

describe('stopProcess', () => {
  it('marks a process that outlived the wait so the row can offer Force stop', async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [processOf({ pid: 77 })] }),
      process_ledger_list: [],
      monitor_stop: { outcome: 'still-running', reason: 'The process did not exit in time.' },
    });

    await useAppStore.getState().stopProcess({ pid: 77, force: false });

    expect(useAppStore.getState().monitorStopping).toEqual({ 77: 'still-running' });
  });

  it('sends force on the second call and clears the mark once it stopped', async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [] }),
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });
    useAppStore.setState({ monitorStopping: { 77: 'still-running' } });

    await useAppStore.getState().stopProcess({ pid: 77, force: true });

    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 77, force: true }]]);
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('keeps the row as it was and reports when the command is refused', async () => {
    const reportError = vi.fn(async () => undefined);
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [processOf({ pid: 1 })] }),
      process_ledger_list: [],
      monitor_stop: { outcome: 'refused', reason: 'This process is required by the system.' },
    });
    useAppStore.setState({ reportError });

    await useAppStore.getState().stopProcess({ pid: 1, force: false });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't stop the process" }),
    );
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('reports a failed command and leaves no stopping mark behind', async () => {
    const reportError = vi.fn(async () => undefined);
    stubStoryInvoke({
      monitor_stop: () => Promise.reject(new Error('ipc closed')),
    });
    useAppStore.setState({ reportError });

    const result = await useAppStore.getState().stopProcess({ pid: 5, force: false });

    expect(result).toBeNull();
    expect(reportError).toHaveBeenCalled();
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });
});

describe('stopLeftovers', () => {
  it('stops every process of the leftovers and counts the stopped ones', async () => {
    stubStoryInvoke({
      monitor_snapshot: snapshotOf({ processes: [] }),
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });

    const stopped = await useAppStore.getState().stopLeftovers({ pids: [6101, 6201] });

    expect(stopped).toBe(2);
    expect(callsTo('monitor_stop').map(([, payload]) => payload)).toEqual([
      { pid: 6101, force: false },
      { pid: 6201, force: false },
    ]);
  });
});
