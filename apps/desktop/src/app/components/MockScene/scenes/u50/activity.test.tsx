// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_ACTIVITY_SCENES } from './activity';

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

describe('the u50 Activity scenes', () => {
  it('opens the Activity page with its crumb and the script rows', async () => {
    const Scene = U50_ACTIVITY_SCENES['u50-activity-dark'];
    if (Scene === undefined) {
      throw new Error('No scene u50-activity-dark');
    }
    render(<Scene />);

    await screen.findByRole('region', { name: 'Log entries' }, { timeout: 3_000 });
    await waitFor(() =>
      expect(document.querySelector('[data-crumb-current]')?.textContent).toContain('Activity'),
    );
    expect(document.body.textContent).toContain('test:integration failed (exit 1) in payments-api');
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U50_ACTIVITY_SCENES)).toEqual(['u50-activity-light', 'u50-activity-dark']);
  });
});
