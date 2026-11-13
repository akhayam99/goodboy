// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { LINKS_SETTING_SCENES } from './links-setting';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
  installFakeResizeObserver();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe('the Links setting scenes', () => {
  it('registers the row in light and dark for the capture', () => {
    expect(Object.keys(LINKS_SETTING_SCENES).sort()).toEqual([
      'settings-links',
      'settings-links-dark',
    ]);
    for (const [id, Scene] of Object.entries(LINKS_SETTING_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('shows the Links row in Open with with In Goodboy chosen', async () => {
    const Scene = LINKS_SETTING_SCENES['settings-links'];
    if (Scene === undefined) {
      throw new Error('no scene settings-links');
    }
    render(<Scene />);

    const row = await screen.findByRole('tablist', { name: 'Links' }, WAIT);
    expect(row.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('In Goodboy');
  });
});
