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
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { NAMES } from '../../../../../shared/utils/names';
import { U50_ASK_LIVE_SCENES } from './askLive';

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
  const Scene = U50_ASK_LIVE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
};

describe('the u50 Ask line scenes', () => {
  it('opens on the two free questions', async () => {
    renderScene({ name: 'u50-ask-live-light' });

    await screen.findByRole('button', { name: NAMES.whatAreYouDoing });
    screen.getByRole('button', { name: NAMES.whatIsLeft });
  });

  it('answers What is left? from the session in the left scene', async () => {
    renderScene({ name: 'u50-ask-live-left-dark' });

    await screen.findByText(
      (text) => text.startsWith(`${NAMES.noPlanOnThisSession}.`),
      {},
      { timeout: 3_000 },
    );
    expect(screen.getByTestId('ask-line-origin').textContent).toBe(NAMES.fromTheSession);
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U50_ASK_LIVE_SCENES)).toEqual([
      'u50-ask-live-light',
      'u50-ask-live-dark',
      'u50-ask-live-doing-light',
      'u50-ask-live-doing-dark',
      'u50-ask-live-left-light',
      'u50-ask-live-left-dark',
    ]);
  });
});
