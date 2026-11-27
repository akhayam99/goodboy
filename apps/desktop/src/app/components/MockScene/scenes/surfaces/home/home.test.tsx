// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { HOME_PLACE_SCENES } from './home';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
  localStorage.clear();
});

describe('the Home place scenes', () => {
  it.each(Object.entries(HOME_PLACE_SCENES))(
    'shows Home as the current door in %s',
    async (_id, Scene) => {
      render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );

      await screen.findByRole('heading', { name: 'Home' }, WAIT);
      const door = screen.getByRole('button', { name: 'Home' });

      expect(door.getAttribute('aria-current')).toBe('page');
      await waitFor(() =>
        expect(document.querySelector('[data-home-widget="sessionsToFinish"]')).not.toBeNull(),
      );
      expect(document.querySelector('[data-home-widget="needsYou"]')).not.toBeNull();
      expect(document.querySelector('[data-home-widget="providerLimits"]')).not.toBeNull();
    },
  );

  it('counts what needs you once: the hero, the badge and the rows agree', async () => {
    const [, Scene] = Object.entries(HOME_PLACE_SCENES)[0] ?? [];
    if (Scene === undefined) {
      throw new Error('no Home scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() =>
      expect(document.querySelector('[data-home-widget="needsYou"]')).not.toBeNull(),
    );
    const card = document.querySelector('[data-home-widget="needsYou"]') ?? document.body;
    const rows = card.querySelectorAll('li').length;
    const finish = document.querySelector('[data-home-widget="sessionsToFinish"]');

    expect(card.querySelector('[data-count-badge]')?.textContent).toBe(String(rows));
    expect(finish?.textContent).toContain(`${rows} need you`);
  });
});
