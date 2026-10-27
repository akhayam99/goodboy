// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_B_INT_FIX_SCENES } from './b-int-fix';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const SETTLE_MS = 100;

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_INT_FIX_SCENES;
};

const renderScene = async ({ name }: RenderSceneParams) => {
  const Scene = U25_B_INT_FIX_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));
};

describe('the u25 integration fix scenes', () => {
  it('registers every scene by name', () => {
    for (const [name, scene] of Object.entries(U25_B_INT_FIX_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(scene);
    }
  });

  it('offers both recovery actions beside Retry after a plain push fails', async () => {
    await renderScene({ name: 'branch-push-failed' });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('seenEvents is assigned but never used');
    expect(within(alert).getByRole('button', { name: 'Fix with agent' })).toBeDefined();
    expect(within(alert).getByRole('button', { name: 'Open terminal here' })).toBeDefined();
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('offers the same two actions after a force push fails', async () => {
    await renderScene({ name: 'branch-force-push-failed' });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Fix with agent' })).toBeDefined();
    expect(within(alert).getByRole('button', { name: 'Open terminal here' })).toBeDefined();
  });
});
