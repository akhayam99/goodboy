// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U37_COMPOSER_SCENES } from './composers';

const SETTLE_MS = 2_000;
const TEST_TIMEOUT_MS = 30_000;
const MODEL_PICKER = /^(Model routing|Model for this chat|Model for Ask|Model): /;

type SceneName = keyof typeof U37_COMPOSER_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U37_COMPOSER_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const composerBoxes = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-composer-surface]')).filter(
    (box) => box.querySelector('[data-composer-footer]') !== null,
  );

describe('the u37 composer scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U37_COMPOSER_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(Object.keys(U37_COMPOSER_SCENES) as ReadonlyArray<SceneName>)(
    '%s draws a composer with its model picker in the footer',
    async (name) => {
      await mount(name);

      const withModel = composerBoxes().filter(
        (box) => within(box).queryAllByRole('button', { name: MODEL_PICKER }).length > 0,
      );
      expect(withModel.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS,
  );
});
