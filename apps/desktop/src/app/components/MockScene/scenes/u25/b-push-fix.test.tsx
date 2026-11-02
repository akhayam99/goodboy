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
import { U25_B_PUSH_FIX_SCENES } from './b-push-fix';

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

const SETTLE_MS = 600;

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_PUSH_FIX_SCENES;
};

const renderScene = async ({ name }: RenderSceneParams) => {
  const Scene = U25_B_PUSH_FIX_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));
};

describe('the u25 push fix scenes', () => {
  it('offers both actions on a hook failure', async () => {
    await renderScene({ name: 'push-failed-hook' });

    const panel = within(screen.getByRole('region', { name: 'Rebase' }));
    expect(panel.getByText('Rebased, but the push failed')).toBeDefined();
    expect(panel.getByRole('button', { name: 'Fix with agent' })).toBeDefined();
    expect(panel.getByRole('button', { name: 'Open terminal here' })).toBeDefined();
    expect(document.querySelector('[data-rebase-conflict]')).toBeNull();
  });

  it('shows the agent fixing and hides the failure actions', async () => {
    await renderScene({ name: 'push-fixing' });

    expect(screen.getByText('Rebased, fixing the push')).toBeDefined();
    expect(screen.getByRole('button', { name: 'See what it did' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fix with agent' })).toBeNull();
  });
});
