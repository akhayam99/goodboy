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

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = HERO_SCENES[name];
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

describe('the hero scenes', () => {
  it('registers one scene per right pane', () => {
    expect(Object.keys(HERO_SCENES)).toEqual(['hero-ask', 'hero-diff', 'hero-agents']);
  });

  it.each(['hero-ask', 'hero-diff', 'hero-agents'])(
    'opens %s on the Overview with three branches in two projects',
    async (name) => {
      const projects = await show({ name });

      expect(within(projects).getByText('hl/fix-duplicate-credit')).toBeInstanceOf(HTMLElement);
      expect(within(projects).getByText('hl/dedupe-load-test')).toBeInstanceOf(HTMLElement);
      expect(within(projects).getByText('hl/surface-retry-state')).toBeInstanceOf(HTMLElement);
    },
  );

  it('keeps the Ask exchange about merging #318 on the right', async () => {
    await show({ name: 'hero-ask' });

    expect(await screen.findByText('Can I merge #318 now?')).toBeInstanceOf(HTMLElement);
  });

  it('lists every agent the Lead picked with its model', async () => {
    await show({ name: 'hero-agents' });

    const list = screen.getByRole('list', { name: 'Agents in this run' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
  });
});
