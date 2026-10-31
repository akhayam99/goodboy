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
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { RELEASE_IMAGE_CASES, releaseImageDataUriOf } from './releaseImagesSeed';
import { U32_RELEASE_IMAGES_SCENES } from './release-images';

const WAIT = { timeout: 15_000 };

const Scene = U32_RELEASE_IMAGES_SCENES['u32-release-images'];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'changelog_image') {
      return Promise.resolve(releaseImageDataUriOf({ payload: args }) ?? null);
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

describe('the release images scene', () => {
  it('registers the scene and mounts the real picture frame for a wide and a tall picture', async () => {
    expect(MOCK_SCENES['u32-release-images']).toBe(Scene);
    render(<Scene />);
    for (const { title } of RELEASE_IMAGE_CASES) {
      await screen.findByRole('img', { name: title }, WAIT);
    }
    expect(document.querySelectorAll('[data-release-image-case]')).toHaveLength(2);
  });

  it('answers only the pictures it draws', () => {
    expect(releaseImageDataUriOf({ payload: { file: 'wide-card-after-dark.webp' } })).toMatch(
      /^data:/,
    );
    expect(releaseImageDataUriOf({ payload: { file: 'other-after-dark.webp' } })).toBeUndefined();
    expect(releaseImageDataUriOf({ payload: null })).toBeUndefined();
  });
});
