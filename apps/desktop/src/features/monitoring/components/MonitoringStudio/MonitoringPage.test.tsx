// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MonitorSnapshot } from '@goodboy/core';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { StopResult } from '../../../../store/slices/monitoring/types';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { MonitoringPage } from './MonitoringPage';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const TAKEN_AT = 1_800_000_000_000;

const EMPTY_SNAPSHOT: MonitorSnapshot = {
  listeners: [],
  processes: [],
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

const NODE_SNAPSHOT: MonitorSnapshot = {
  listeners: [{ port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 4100 }],
  processes: [
    {
      pid: 4100,
      ppid: 1,
      pgid: 4100,
      name: 'node',
      cwd: '/mock/harborline/payments-api',
      startedAt: TAKEN_AT - 3_600_000,
      cpuPercent: 1.2,
      rssBytes: 212 * 1024 * 1024,
      uid: 501,
      argsMasked: 'node server.js',
    },
  ],
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

type StopAnswer = StopResult | Promise<StopResult>;

type StubParams = {
  readonly snapshot: MonitorSnapshot;
  readonly stop?: () => StopAnswer;
};

const stub = ({ snapshot, stop }: StubParams) => {
  stubStoryInvoke({
    monitor_snapshot: snapshot,
    process_ledger_list: [],
    monitor_watched_ports: [],
    ...(stop === undefined ? {} : { monitor_stop: stop }),
  });
};

const callsTo = (command: string) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
  useAppStore.setState({ monitorPinned: [{ port: 5005, description: 'Ledger web' }] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPage = () =>
  render(
    <ObjectMenuProvider>
      <MonitoringPage />
    </ObjectMenuProvider>,
  );

const portRow = (port: number): HTMLElement => {
  const row = document.querySelector(`[data-port-row="${port}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for :${port}`);
  }
  return row;
};

const hasPortRow = (port: number): boolean =>
  document.querySelector(`[data-port-row="${port}"]`) !== null;

const readyRow = async (): Promise<HTMLElement> => {
  renderPage();
  await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
  return portRow(5005);
};

describe('the quiet row', () => {
  it('holds Stop and the menu in one cell that shows on hover and focus, not at rest', async () => {
    stub({ snapshot: NODE_SNAPSHOT });
    const row = await readyRow();

    const cells = row.querySelectorAll('[data-actions-cell]');
    expect(cells).toHaveLength(1);
    const reveals = [...(cells[0]?.querySelectorAll('.row-actions') ?? [])].map(
      (node) => node.className,
    );
    expect(reveals).toHaveLength(2);
    for (const className of reveals) {
      expect(className).toContain('row-actions');
    }
    expect(within(row).getByRole('button', { name: 'Stop node' })).toBeDefined();
    expect(within(row).getByRole('button', { name: 'Actions for :5005' })).toBeDefined();
  });

  it('keeps the group header to a name and a meta line with its free ports', async () => {
    useAppStore.setState({
      monitorPinned: [
        { port: 5005, description: 'Ledger web' },
        { port: 9000, description: 'Mock API' },
      ],
    });
    stub({ snapshot: NODE_SNAPSHOT });
    renderPage();
    await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
    const pinned = screen.getByRole('region', { name: 'Pinned' });

    expect(pinned.querySelector('h2')?.textContent).toBe('Pinned');
    expect(within(pinned).getByRole('button', { name: '1 free: :9000' }).textContent).toBe(
      '1 free',
    );
    expect(hasPortRow(9000)).toBe(false);

    fireEvent.click(within(pinned).getByRole('button', { name: '1 free: :9000' }));

    expect(within(portRow(9000)).getByText('Free')).toBeDefined();
  });

  it('opens the registry menu on right click, with Stop and Force stop in it', async () => {
    stub({ snapshot: NODE_SNAPSHOT });
    const row = await readyRow();

    fireEvent.contextMenu(row);
    const menu = await screen.findByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(
      expect.arrayContaining(['Open in browser', 'Edit description', 'Stop', 'Force stop']),
    );
  });
});

describe('Stop from the row', () => {
  it('asks first and names who loses the port, then stops by pid and refreshes', async () => {
    stub({ snapshot: NODE_SNAPSHOT, stop: () => ({ outcome: 'stopped', reason: null }) });
    const row = await readyRow();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop node' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stop node on :5005?' });

    expect(within(dialog).getByText('Anything using it stops too.')).toBeDefined();
    expect(callsTo('monitor_stop')).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop' }));

    await waitFor(() =>
      expect(callsTo('monitor_stop')).toEqual([['monitor_stop', { pid: 4100, force: false }]]),
    );
  });

  it('does not stop anything when the confirm is cancelled', async () => {
    stub({ snapshot: NODE_SNAPSHOT, stop: () => ({ outcome: 'stopped', reason: null }) });
    const row = await readyRow();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop node' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(callsTo('monitor_stop')).toEqual([]);
    expect(within(row).getByRole('button', { name: 'Stop node' })).toBeDefined();
  });

  it('shows Stopping while it runs, then Force stop once the process outlived the wait', async () => {
    let settle: (result: StopResult) => void = () => undefined;
    const pending = new Promise<StopResult>((resolve) => {
      settle = resolve;
    });
    stub({ snapshot: NODE_SNAPSHOT, stop: () => pending });
    const row = await readyRow();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop node' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => expect(within(row).getByText('Stopping')).toBeDefined());
    expect(within(row).queryByRole('button', { name: 'Stop node' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Force stop node' })).toBeNull();

    await act(async () => {
      settle({ outcome: 'still-running', reason: 'The process did not exit in time.' });
      await pending;
    });

    await waitFor(() =>
      expect(within(row).getByRole('button', { name: 'Force stop node' })).toBeDefined(),
    );
    expect(within(row).queryByText('Stopping')).toBeNull();
    expect(useAppStore.getState().monitorStopping).toEqual({ 4100: 'still-running' });
  });

  it('sends force on the second stop and keeps the confirm a danger', async () => {
    stub({
      snapshot: NODE_SNAPSHOT,
      stop: () => ({ outcome: 'still-running', reason: 'The process did not exit in time.' }),
    });
    const row = await readyRow();
    fireEvent.click(within(row).getByRole('button', { name: 'Stop node' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    fireEvent.click(await within(row).findByRole('button', { name: 'Force stop node' }));
    const dialog = await screen.findByRole('dialog', { name: 'Force stop node on :5005?' });

    expect(within(dialog).getByText(/^Ends it at once/)).toBeDefined();
    stub({ snapshot: NODE_SNAPSHOT, stop: () => ({ outcome: 'stopped', reason: null }) });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Force stop' }));

    await waitFor(() =>
      expect(callsTo('monitor_stop').at(-1)).toEqual(['monitor_stop', { pid: 4100, force: true }]),
    );
  });

  it('keeps the row and reports the refusal when the process cannot be stopped', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    stub({
      snapshot: NODE_SNAPSHOT,
      stop: () => ({ outcome: 'refused', reason: 'This process is required by the system.' }),
    });
    const row = await readyRow();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop node' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't stop the process" }),
      ),
    );
    await waitFor(() => expect(within(row).queryByText('Stopping')).toBeNull());

    expect(hasPortRow(5005)).toBe(true);
    expect(within(row).getByRole('button', { name: 'Stop node' })).toBeDefined();
    expect(useAppStore.getState().monitorStopping).toEqual({});
  });
});

describe('the empty page', () => {
  it('teaches what fills it and offers one Pin a port, with no filter above nothing', async () => {
    useAppStore.setState({ monitorPinned: [] });
    stub({ snapshot: EMPTY_SNAPSHOT });
    renderPage();

    const heading = await screen.findByRole('heading', { name: 'No ports in use' });

    expect(heading).toBeDefined();
    expect(
      screen.getByText(
        'Ports opened by agents, terminals and scripts appear here, with their process.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Nothing tracked')).toBeDefined();
    expect(screen.queryByRole('searchbox', { name: 'Filter ports' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Pin a port' })).toHaveLength(1);
  });
});
