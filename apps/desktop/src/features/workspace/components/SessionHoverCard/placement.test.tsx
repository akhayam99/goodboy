// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  ledgerCore,
  renderBar,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const webhook = sessionOf({
  goal: 'Fix webhook retries',
  state: runningState(),
  updatedAt: '2026-10-06T09:55:00.000Z',
  lastOpenedAt: '2026-10-06T08:00:00.000Z',
});

type RowBox = {
  readonly top: number;
};

const boxAt = ({ top }: RowBox): DOMRect =>
  ({
    top,
    bottom: top + 28,
    left: 16,
    right: 216,
    width: 200,
    height: 28,
    x: 16,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

const openCardAt = ({ top }: RowBox) => {
  seedColumn({
    store: useAppStore,
    sessions: [webhook],
    archived: [],
    questions: [],
    mounts: [[webhook, ledgerCore]],
  });
  renderBar();
  const row = screen.getByRole('option', { name: 'Fix webhook retries' });
  row.getBoundingClientRect = () => boxAt({ top });
  fireEvent.mouseEnter(row);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  return row;
};

describe('the hover card placement', () => {
  it('opens beside its row, a gap above the row top', () => {
    openCardAt({ top: 300 });
    expect(screen.getByTestId('session-hover-card').style.top).toBe('292px');
  });

  it('measures again when a list scrolls under it', () => {
    const row = openCardAt({ top: 300 });
    row.getBoundingClientRect = () => boxAt({ top: 180 });
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
    });
    expect(screen.getByTestId('session-hover-card').style.top).toBe('172px');
  });

  it('stays inside the window after a resize', () => {
    openCardAt({ top: 700 });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(
      Number.parseFloat(screen.getByTestId('session-hover-card').style.top),
    ).toBeLessThanOrEqual(292);
  });
});
