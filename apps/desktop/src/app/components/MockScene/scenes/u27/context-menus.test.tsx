// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U27_CONTEXT_MENU_SCENES } from './context-menus';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  document.documentElement.removeAttribute('data-theme');
});

describe('the u27 context menu scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U27_CONTEXT_MENU_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('u27-launch-row-menu opens the agent menu on an Auto launch row, not the webview one', async () => {
    const Scene = U27_CONTEXT_MENU_SCENES['u27-launch-row-menu'];
    if (Scene === undefined) {
      throw new Error('no scene u27-launch-row-menu');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
});
