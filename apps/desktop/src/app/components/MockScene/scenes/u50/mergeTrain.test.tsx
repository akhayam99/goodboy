// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import type {
  StartMergeTrainParams,
  StartMergeTrainResult,
} from '../../../../../store/slices/pr-series/startMergeTrain';
import { U50_MERGE_TRAIN_SCENES } from './mergeTrain';

let useAppStore: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
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
  return screen.findByRole('group', { name: 'in review' });
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

  it('offers Merge 2 in order in the In review lane header and starts the train with both', async () => {
    const lane = await show({ name: 'u50-merge-train-ready-light' });
    const merge = await within(lane).findByRole('button', { name: 'Merge 2 in order' });
    const start = vi.fn<(params: StartMergeTrainParams) => Promise<StartMergeTrainResult>>(
      async () => ({ kind: 'busy' }),
    );
    useAppStore.setState({ startMergeTrain: start });

    fireEvent.click(merge);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      method: 'squash',
      cars: [expect.objectContaining({ prNumber: 305 }), expect.objectContaining({ prNumber: 76 })],
    });
  });

  it('shows the running train as one line with Stop after this one', async () => {
    const lane = await show({ name: 'u50-merge-train-running-dark' });
    await waitFor(() => within(lane).getByText('Updating #305 on main · checks running'));
    within(lane).getByRole('button', { name: 'Stop after this one' });
  });
});
