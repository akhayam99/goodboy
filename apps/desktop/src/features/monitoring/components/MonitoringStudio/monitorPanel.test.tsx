// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MonitorSnapshot } from '@goodboy/core/monitoring';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { MonitoringDrawer } from './MonitoringDrawer';

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
  stubStoryInvoke({
    monitor_snapshot: SNAPSHOT,
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
  useAppStore.setState({ monitorPinned: [{ port: 5005, description: 'Ledger web' }] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPanel = (onClose: () => void = () => undefined) =>
  render(
    <ObjectMenuProvider>
      <MonitoringDrawer onClose={onClose} />
    </ObjectMenuProvider>,
  );

describe('the Monitor panel', () => {
  it('lists the same port rows as the Monitoring page, inside the panel frame', async () => {
    renderPanel();

    const panel = screen.getByRole('region', { name: 'Monitoring' });
    await waitFor(() => expect(panel.querySelector('[data-port-row="5005"]')).not.toBeNull(), {
      timeout: 4000,
    });
    expect(screen.getByTestId('monitoring-panel').closest('section')).toBe(panel);
  });

  it('opens the full Monitoring page from its head and closes from its X', async () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Open full page' }));
    expect(useAppStore.getState().appStudio?.kind).toBe('monitoring');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
