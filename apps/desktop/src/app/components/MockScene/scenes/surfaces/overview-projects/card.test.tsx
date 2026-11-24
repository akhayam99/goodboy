// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../../features/actions/components/ObjectMenuProvider';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { OVERVIEW_PROJECTS_CARD_SCENES } from './card';

const WAIT = { timeout: 5000 };

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
  const Scene = OVERVIEW_PROJECTS_CARD_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown projects card scene');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

describe('the projects card scenes', () => {
  it('registers each scene in both themes', () => {
    const ids = Object.keys(OVERVIEW_PROJECTS_CARD_SCENES);

    expect(ids).toEqual([
      'overview-projects-head-light',
      'overview-projects-head-dark',
      'overview-projects-close-light',
      'overview-projects-close-dark',
    ]);
    ids.forEach((id) => expect(MOCK_SCENES[id]).toBe(OVERVIEW_PROJECTS_CARD_SCENES[id]));
  });

  it.each(['overview-projects-head-light', 'overview-projects-head-dark'])(
    '%s draws New branch in the head and a disabled Unmount',
    async (name) => {
      await show({ name });
      const head = document.querySelector<HTMLElement>('[data-board-project-head]');
      if (head === null) {
        throw new Error('the project head must draw');
      }

      within(head).getByRole('button', { name: /^New branch in / });
      const unmount = within(head).getByRole('button', { name: /^Unmount / });
      expect(unmount.hasAttribute('disabled')).toBe(true);
      expect(screen.queryByRole('button', { name: /dev details/ })).toBeNull();
      screen.getByRole('button', { name: 'Mount a project' });
    },
  );

  it.each(['overview-projects-close-light', 'overview-projects-close-dark'])(
    '%s opens the close confirm with both folder outcomes',
    async (name) => {
      await show({ name });

      const confirm = within(await screen.findByRole('group', { name: /^Close the branch/ }, WAIT));
      confirm.getByRole('button', { name: 'Remove the folder' });
      confirm.getByRole('button', { name: 'Keep the folder' });
      confirm.getByRole('button', { name: 'Cancel' });
    },
  );
});
