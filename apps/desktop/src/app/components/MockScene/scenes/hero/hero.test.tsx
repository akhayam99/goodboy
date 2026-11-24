// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { HERO_SCENES } from './hero';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
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

const show = async () => {
  const Scene = HERO_SCENES['hero-diff'];
  if (Scene === undefined) {
    throw new Error('Unknown hero scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('region', { name: 'Projects' });
};

describe('the hero scene', () => {
  it('registers only the diff hero', () => {
    expect(Object.keys(HERO_SCENES)).toEqual(['hero-diff']);
  });

  it('opens the Overview with three branches in two projects', async () => {
    const projects = await show();

    expect(within(projects).getByText('hl/fix-duplicate-credit')).toBeInstanceOf(HTMLElement);
    expect(within(projects).getByText('hl/dedupe-load-test')).toBeInstanceOf(HTMLElement);
    expect(within(projects).getByText('hl/surface-retry-state')).toBeInstanceOf(HTMLElement);
  });

  it('opens the diff of the file #318 shares with HBL-415 on the right', async () => {
    await show();
    const drawer = await screen.findByRole('region', { name: 'postCredit.ts' });

    expect(await within(drawer).findByText('event.processorEventId')).toBeInstanceOf(HTMLElement);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_diff', {
      worktreePath: '/w/harborline/payments-api',
      baseBranch: 'main',
    });
  });
});
