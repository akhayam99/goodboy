// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { liveMounts } from '../../../../../features/overlap/liveMounts';
import { U50_OVERLAP_SCENES } from './overlap';

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  liveMounts.reset();
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
  liveMounts.reset();
});

type SceneParams = {
  readonly name: string;
};

const renderScene = ({ name }: SceneParams) => {
  const Scene = U50_OVERLAP_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
};

describe('the u50 overlap scenes', () => {
  it('puts a chip on each row of the two overlapping sessions', async () => {
    renderScene({ name: 'u50-overlap-light' });

    await screen.findByRole('button', { name: 'Overlaps Batch the Northwind statements' });
    screen.getByRole('button', { name: 'Overlaps Retry the Harborline ledger export' });
  });

  it('opens the popover with the file and the order in the open scene', async () => {
    renderScene({ name: 'u50-overlap-open-dark' });

    await screen.findByRole('button', { name: 'Message both Implementers' }, { timeout: 3_000 });
    expect(screen.getByRole('dialog', { name: 'Overlap' }).textContent).toContain(
      'Both branches change src/retry/state.ts.',
    );
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U50_OVERLAP_SCENES)).toEqual([
      'u50-overlap-light',
      'u50-overlap-dark',
      'u50-overlap-open-light',
      'u50-overlap-open-dark',
    ]);
  });
});
