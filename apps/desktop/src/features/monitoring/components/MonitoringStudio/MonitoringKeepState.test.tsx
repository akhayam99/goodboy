// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MonitorSnapshot } from '@goodboy/core/monitoring';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
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

const SNAPSHOT: MonitorSnapshot = {
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

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
  useAppStore.setState({
    monitorPinned: [
      { port: 5005, description: 'Ledger web' },
      { port: 9000, description: 'Mock API' },
    ],
  });
  stubStoryInvoke({
    monitor_snapshot: SNAPSHOT,
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
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

const hasPortRow = (port: number): boolean =>
  document.querySelector(`[data-port-row="${port}"]`) !== null;

const mountPage = async () => {
  const view = renderPage();
  await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
  return view;
};

describe('Monitoring keeps its state when you leave and come back', () => {
  it('keeps the search text', async () => {
    const first = await mountPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter ports' }), {
      target: { value: '5005' },
    });
    first.unmount();

    await mountPage();

    const field = screen.getByRole('searchbox', { name: 'Filter ports' });
    expect(field).toHaveProperty('value', '5005');
  });

  it('keeps a free ports fold open', async () => {
    const first = await mountPage();
    const pinned = screen.getByRole('region', { name: 'Pinned' });
    fireEvent.click(within(pinned).getByRole('button', { name: '1 free: :9000' }));
    expect(hasPortRow(9000)).toBe(true);
    first.unmount();

    await mountPage();

    expect(hasPortRow(9000)).toBe(true);
  });

  it('keeps an opened command line', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    expect(screen.queryByText('node server.js')).not.toBeNull();
    first.unmount();

    await mountPage();

    expect(screen.queryByText('node server.js')).not.toBeNull();
  });
});
