// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U28_RUNNING_LIST_SCENES } from './running-list';

const KEYS = ['u28-running-list-light', 'u28-running-list-dark'];

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

type ShowParams = {
  readonly name: string;
};

const show = async ({ name }: ShowParams) => {
  const Scene = U28_RUNNING_LIST_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown running list scene');
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

describe('the Running list scenes', () => {
  it('registers a light and a dark scene', () => {
    expect(Object.keys(U28_RUNNING_LIST_SCENES)).toEqual(KEYS);
    for (const [id, Scene] of Object.entries(U28_RUNNING_LIST_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws the board with a Needs you group for the work that waits', async () => {
    await show({ name: KEYS[0] ?? '' });

    screen.getByRole('region', { name: 'Branches' });
    expect(document.querySelector('[data-slot="session-kpis"]')?.children).toHaveLength(5);
  });

  it.each(KEYS)('%s has no accessibility violations', async (name) => {
    const { container } = await show({ name });
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
