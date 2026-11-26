// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { MonitorSnapshot } from '@goodboy/core/monitoring';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
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

const HEADER_NAMES = ['Port', 'Label', 'Opened by', 'Process', 'Up', 'CPU', 'Memory'] as const;

let resizer: ReturnType<typeof installFakeResizeObserver>;

beforeEach(async () => {
  await resetStoryStore();
  resizer = installFakeResizeObserver();
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
  vi.unstubAllGlobals();
});

type WidthParams = {
  readonly width: number;
};

const renderAt = async ({ width }: WidthParams): Promise<void> => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    return this.getAttribute('data-testid') === 'monitoring-panel'
      ? new DOMRect(0, 0, width, 600)
      : new DOMRect(0, 0, 0, 0);
  });
  render(
    <ObjectMenuProvider>
      <MonitoringDrawer onClose={() => undefined} />
    </ObjectMenuProvider>,
  );
  await waitFor(() => expect(document.querySelector('[data-port-row="5005"]')).not.toBeNull(), {
    timeout: 4000,
  });
  act(() => resizer.resizeAll());
};

const headerNames = (): ReadonlyArray<string> => {
  const header = document.querySelector('[data-column-header]');
  return HEADER_NAMES.filter((name) =>
    Array.from(header?.children ?? []).some((cell) => cell.textContent === name),
  );
};

type ShapeParams = {
  readonly selector: string;
};

const shapeOf = ({ selector }: ShapeParams) => {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`Nothing matches ${selector}`);
  }
  return {
    cells: element.children.length,
    tracks: (/grid-cols-\[([^\]]+)\]/.exec(element.className)?.[1] ?? '').split('_').length,
  };
};

const expectOneCellPerTrack = (): void => {
  const header = shapeOf({ selector: '[data-column-header]' });
  const row = shapeOf({ selector: '[data-port-row="5005"] > div' });
  expect(header.cells).toBe(header.tracks);
  expect(row.cells).toBe(row.tracks);
  expect(row.tracks).toBe(header.tracks);
};

describe('the Monitor panel columns', () => {
  it('keeps Port, Opened by and Process at 384, with one cell for every track', async () => {
    await renderAt({ width: 384 - 18 });

    expect(headerNames()).toEqual(['Port', 'Opened by', 'Process']);
    expectOneCellPerTrack();
  });

  it('hides Label and Up at 480 and keeps CPU and Memory, with one cell for every track', async () => {
    await renderAt({ width: 480 - 18 });

    expect(headerNames()).toEqual(['Port', 'Opened by', 'Process', 'CPU', 'Memory']);
    expectOneCellPerTrack();
  });

  it('shows every column when the room is wide, as the full page does', async () => {
    await renderAt({ width: 900 });

    expect(headerNames()).toEqual([...HEADER_NAMES]);
    expectOneCellPerTrack();
    screen.getByRole('region', { name: 'Monitoring' });
  });
});
