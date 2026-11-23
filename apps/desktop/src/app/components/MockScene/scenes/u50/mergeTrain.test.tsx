// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_MERGE_TRAIN_SCENES } from './mergeTrain';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
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

type Params = { readonly name: string };

const show = async ({ name }: Params): Promise<HTMLElement> => {
  const Scene = U50_MERGE_TRAIN_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown merge train scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('region', { name: 'Ready to merge' });
};

describe('the u50 merge train scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_MERGE_TRAIN_SCENES)).toEqual([
      'u50-merge-train-ready-light',
      'u50-merge-train-ready-dark',
      'u50-merge-train-running-light',
      'u50-merge-train-running-dark',
    ]);
  });

  it('lists the ready pull requests in order with the reason under the first', async () => {
    const band = await show({ name: 'u50-merge-train-ready-light' });
    await waitFor(() => expect(band.querySelectorAll('[data-ready-row]')).toHaveLength(2));
    within(band).getByRole('button', { name: 'Merge in order' });
    expect(band.querySelector('[data-ready-reason]')?.textContent).toBe('First: waiting longest');
  });

  it('shows the running train as one line with Stop after this one', async () => {
    const band = await show({ name: 'u50-merge-train-running-dark' });
    await waitFor(() => within(band).getByText('Updating #305 on main · checks running'));
    within(band).getByRole('button', { name: 'Stop after this one' });
  });
});
