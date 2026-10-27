// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U28_BELL_OVERFLOW_SCENES } from './bell-overflow';

const SETTLE_MS = 2_000;
const SCENE = 'u28-bell-overflow';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

type MountParams = {
  readonly id?: string;
};

const mount = async ({ id = SCENE }: MountParams = {}): Promise<Element> => {
  const Scene = U28_BELL_OVERFLOW_SCENES[id];
  if (Scene === undefined) {
    throw new Error('no scene');
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the bell overflow scene', () => {
  it('registers the scenes for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U28_BELL_OVERFLOW_SCENES[SCENE]);
    expect(MOCK_SCENES['u28-bell-opened']).toBe(U28_BELL_OVERFLOW_SCENES['u28-bell-opened']);
  });

  it('shows the real count on the bell and all eleven unread rows in the list', async () => {
    await mount();

    screen.getByRole('button', { name: 'Notifications, 11 unread' });
    expect(document.querySelector('[data-bell-count]')?.textContent).toBe('9+');
    expect(document.querySelector('[data-bell-dot]')?.getAttribute('data-bell-dot')).toBe(
      'warning',
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.querySelector('[data-unread-dot]') !== null)).toBe(true);
    within(screen.getByRole('tab', { name: /unread/i })).getByText('11');
  });

  it('dims a pointer that was opened and keeps the retries and the unopened link as they were', async () => {
    await mount({ id: 'u28-bell-opened' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    const opened = rows.filter((row) => row.querySelector('[data-notification-acted]') !== null);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.textContent).toContain('Session reached 80% of its limit');
    expect(opened[0]?.querySelector('[data-unread-dot]')).toBeNull();
    expect(
      rows.map((row) => row.querySelector('[data-unread-dot]')?.getAttribute('data-unread-dot')),
    ).toEqual(['warning', 'warning', undefined, 'primary']);
  });

  it('has no accessibility violation', async () => {
    const container = await mount();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
