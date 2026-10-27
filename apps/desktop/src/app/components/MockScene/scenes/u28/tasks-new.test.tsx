// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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
import { U28_TASKS_NEW_SCENES } from './tasks-new';

const SETTLE_MS = 2_000;
const SCENE = 'u28-tasks-new';

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

const mount = async (): Promise<Element> => {
  const Scene = U28_TASKS_NEW_SCENES[SCENE];
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

describe('the tasks arrivals scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U28_TASKS_NEW_SCENES[SCENE]);
  });

  it('dots two arrivals, counts them in the header and dots the Tasks door', async () => {
    await mount();

    expect(document.querySelectorAll('[data-task-new]')).toHaveLength(2);
    screen.getByText(/\d+ open, 2 new/);
    expect(
      document.querySelector('[data-column-door="inbox"] [data-door-signal="unread"]'),
    ).not.toBeNull();
  });

  it('has no accessibility violation', async () => {
    const container = await mount();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
