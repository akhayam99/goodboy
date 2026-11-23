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
import { U50_MOUNTS_SCENES } from './mounts';

beforeAll(async () => {
  await import('../../../../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectList');
});

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
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

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U50_MOUNTS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown mounts scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

describe('the mounts scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_MOUNTS_SCENES)).toEqual([
      'u50-mounts-picker-light',
      'u50-mounts-picker-dark',
      'u50-mounts-unmount-light',
      'u50-mounts-unmount-dark',
    ]);
  });

  it('opens Mount a folder from the head of Projects, with Choose a folder at the end', async () => {
    await show({ name: 'u50-mounts-picker-dark' });

    const picker = within(
      await screen.findByRole('dialog', { name: 'Mount a folder' }, { timeout: 2000 }),
    );
    await picker.findByRole('button', { name: 'Choose a folder…' });
  });

  it('asks before it unmounts, and never says Remove from session', async () => {
    await show({ name: 'u50-mounts-unmount-light' });

    await screen.findByRole('dialog', { name: 'Unmount payments-api?' }, { timeout: 2000 });
    expect(screen.queryByText(/from session/)).toBeNull();
  });
});
