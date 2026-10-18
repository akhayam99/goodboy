import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LedgerRow, MonitorSnapshot } from '@goodboy/core';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { bindTarget } from '../registry';
import type { ActionEnv } from '../types';
import type { PortFacts } from './port';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const EMPTY_SNAPSHOT: MonitorSnapshot = {
  listeners: [],
  processes: [],
  takenAt: 1,
  isPlatformSupported: true,
};

const scriptEntry = ({ pid }: { readonly pid: number }): LedgerRow => ({
  spawnId: `script-${pid}`,
  kind: 'script',
  pid,
  pgid: pid,
  sessionId: SESSION_ID,
  mountPath: null,
  cwd: '/work/payments-api',
  startedAt: 1,
});

const callsTo = (command: string) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

const copied: Array<string> = [];

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async ({ text }) => {
    copied.push(text);
  },
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

type FactsParams = {
  readonly facts: PortFacts;
};

const bound = ({ facts }: FactsParams) => {
  const found = bindTarget({ state: useAppStore.getState(), target: { kind: 'port', facts } });
  if (found === null) {
    throw new Error('the port target did not bind');
  }
  return found;
};

const idsOf = ({ facts }: FactsParams): ReadonlyArray<string> =>
  bound({ facts })
    .resolve()
    .map((action) => action.id);

const FOREIGN: PortFacts = {
  port: 5173,
  layer: 'listening',
  description: '',
  holder: { pid: 4100, name: 'node', spawnId: null, owner: null },
};

const OWNED: PortFacts = {
  port: 4001,
  layer: 'goodboy',
  description: '',
  holder: { pid: 6200, name: 'node', spawnId: 'script-6200', owner: 'Terminal · payments-api' },
};

describe('the port kind, live verbs', () => {
  it('lists Open in browser, Pin, Stop, Force stop, Hide, then Copy address for a held port', () => {
    expect(idsOf({ facts: FOREIGN })).toEqual([
      'port.openInBrowser',
      'port.pin',
      'port.stop',
      'port.forceStop',
      'port.hide',
      'port.copyAddress',
    ]);
  });

  it('keeps Edit description and Unpin ahead of Stop on a pinned port', () => {
    expect(idsOf({ facts: { ...FOREIGN, layer: 'pinned', description: 'Ledger web' } })).toEqual([
      'port.openInBrowser',
      'port.editDescription',
      'port.unpin',
      'port.stop',
      'port.forceStop',
      'port.copyAddress',
    ]);
  });

  it('offers no Stop, no Open and no Copy address when the row carries no holder', () => {
    expect(idsOf({ facts: { port: 5173, layer: 'workspace', description: '' } })).toEqual([
      'port.pin',
      'port.hide',
    ]);
  });

  it('offers no Stop on a held port whose process id is unknown', () => {
    const ids = idsOf({
      facts: { ...FOREIGN, holder: { pid: null, name: 'node', spawnId: null, owner: null } },
    });
    expect(ids).toEqual(['port.openInBrowser', 'port.pin', 'port.hide', 'port.copyAddress']);
  });

  it('offers only Stop and Force stop on a process that holds no port', () => {
    const facts: PortFacts = {
      port: null,
      layer: 'goodboy',
      description: '',
      holder: {
        pid: 6301,
        name: 'zsh',
        spawnId: 'terminal-6301',
        owner: 'Terminal · payments-api',
      },
    };
    const stop = bound({ facts })
      .resolve()
      .find((action) => action.id === 'port.stop');

    expect(idsOf({ facts })).toEqual(['port.stop', 'port.forceStop']);
    expect(stop?.confirm?.title).toBe('Stop zsh?');
    expect(stop?.confirm?.description).toBe('Terminal · payments-api stops with it.');
  });

  it('asks before Stop and names who loses the port', () => {
    const stop = bound({ facts: OWNED })
      .resolve()
      .find((action) => action.id === 'port.stop');

    expect(stop?.confirm).toEqual({
      title: 'Stop node on :4001?',
      description: 'Terminal · payments-api stops with it.',
      confirmLabel: 'Stop',
      role: 'alert',
    });
  });

  it('says anything using the port stops too when nobody owns it', () => {
    const stop = bound({ facts: FOREIGN })
      .resolve()
      .find((action) => action.id === 'port.stop');

    expect(stop?.confirm?.description).toBe('Anything using it stops too.');
  });

  it('confirms Force stop as a danger and says it ends the process at once', () => {
    const force = bound({ facts: FOREIGN })
      .resolve()
      .find((action) => action.id === 'port.forceStop');

    expect(force?.confirm?.role).toBe('danger');
    expect(force?.confirm?.title).toBe('Force stop node on :5173?');
    expect(force?.confirm?.description).toContain('Ends it at once');
  });

  it('blocks both verbs while the stop is running', () => {
    useAppStore.setState({ monitorStopping: { 4100: 'stopping' } });

    const resolved = bound({ facts: FOREIGN }).resolve();

    expect(resolved.find((action) => action.id === 'port.stop')?.blockedReason).toBe('Stopping');
    expect(resolved.find((action) => action.id === 'port.forceStop')?.blockedReason).toBe(
      'Stopping',
    );
  });

  it('drops Stop and explains Force stop once the process outlived the wait', () => {
    useAppStore.setState({ monitorStopping: { 4100: 'still-running' } });

    const resolved = bound({ facts: FOREIGN }).resolve();

    expect(resolved.map((action) => action.id)).not.toContain('port.stop');
    expect(resolved.find((action) => action.id === 'port.forceStop')?.description).toBe(
      'It did not stop on its own',
    );
  });
});

describe('Stop and Force stop', () => {
  it('stops a process Goodboy did not start by its process id', async () => {
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });

    const outcome = await bound({ facts: FOREIGN }).run({ actionId: 'port.stop', env: env() });

    expect(outcome).toBe('done');
    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 4100, force: false }]]);
    expect(callsTo('monitor_snapshot').length).toBeGreaterThan(0);
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('stops a Goodboy row through its spawn id', async () => {
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [scriptEntry({ pid: 6200 })],
      monitor_stop: { outcome: 'stopped', reason: null },
    });
    useAppStore.setState({ monitorLedger: [scriptEntry({ pid: 6200 })], scriptRuns: {} });

    const outcome = await bound({ facts: OWNED }).run({ actionId: 'port.stop', env: env() });

    expect(outcome).toBe('done');
    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 6200, force: false }]]);
  });

  it('keeps the row and reports the refusal, then reports nothing done', async () => {
    const reportError = vi.fn(async () => undefined);
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'refused', reason: 'This process is required by the system.' },
    });
    useAppStore.setState({ reportError });

    const outcome = await bound({ facts: FOREIGN }).run({ actionId: 'port.stop', env: env() });

    expect(outcome).toBe('unchanged');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't stop the process" }),
    );
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('offers Force stop after a process that did not exit, and sends force the second time', async () => {
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'still-running', reason: 'The process did not exit in time.' },
    });

    const first = await bound({ facts: FOREIGN }).run({ actionId: 'port.stop', env: env() });

    expect(first).toBe('unchanged');
    expect(useAppStore.getState().monitorStopping).toEqual({ 4100: 'still-running' });
    expect(idsOf({ facts: FOREIGN })).toContain('port.forceStop');
    expect(idsOf({ facts: FOREIGN })).not.toContain('port.stop');

    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });
    const second = await bound({ facts: FOREIGN }).run({
      actionId: 'port.forceStop',
      env: env(),
    });

    expect(second).toBe('done');
    expect(callsTo('monitor_stop').at(-1)).toEqual(['monitor_stop', { pid: 4100, force: true }]);
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });

  it('force stops a Goodboy row by its process id, never through its own cancel', async () => {
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });

    await bound({ facts: OWNED }).run({ actionId: 'port.forceStop', env: env() });

    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 6200, force: true }]]);
  });

  it('stops the process of the facts it was bound with, not the one in the store now', async () => {
    stubStoryInvoke({
      monitor_snapshot: EMPTY_SNAPSHOT,
      process_ledger_list: [],
      monitor_stop: { outcome: 'stopped', reason: null },
    });
    const target = bound({ facts: FOREIGN });
    useAppStore.setState({ monitorStopping: { 9999: 'stopping' } });

    await target.run({ actionId: 'port.stop', env: env() });

    expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 4100, force: false }]]);
  });

  it('refuses Stop on a port with no holder', async () => {
    const outcome = await bound({
      facts: { port: 5173, layer: 'workspace', description: '' },
    }).run({ actionId: 'port.stop', env: env() });

    expect(outcome).toBe('unchanged');
    expect(callsTo('monitor_stop')).toEqual([]);
  });
});

describe('Copy address and Open in browser', () => {
  it('copies the local address of the port', async () => {
    copied.length = 0;

    await bound({ facts: FOREIGN }).run({ actionId: 'port.copyAddress', env: env() });

    expect(copied).toEqual(['localhost:5173']);
  });

  it('opens the local address in the browser', async () => {
    stubStoryInvoke({ open_url: null });

    await bound({ facts: FOREIGN }).run({ actionId: 'port.openInBrowser', env: env() });

    expect(callsTo('open_url')).toEqual([['open_url', { url: 'http://localhost:5173' }]]);
  });
});
