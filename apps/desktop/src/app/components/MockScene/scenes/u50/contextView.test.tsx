// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { NAMES } from '../../../../../shared/utils/names';
import { U50_CONTEXT_VIEW_SCENES } from './contextView';

beforeAll(async () => {
  installFakeResizeObserver();
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

type SceneParams = {
  readonly name: string;
};

const renderScene = ({ name }: SceneParams) => {
  const Scene = U50_CONTEXT_VIEW_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
};

describe('the u50 What Goodboy sends scenes', () => {
  it('shows the roles and the running agent filling its context window', async () => {
    renderScene({ name: 'u50-context-view-dark' });

    const card = await screen.findByRole('region', { name: NAMES.whatGoodboySends });
    expect(card.querySelectorAll('[data-send-row]').length).toBeGreaterThan(1);
    within(card).getByRole('meter', { name: 'Add the stuck-delivery banner context window' });
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U50_CONTEXT_VIEW_SCENES)).toEqual([
      'u50-context-view-light',
      'u50-context-view-dark',
    ]);
  });
});
