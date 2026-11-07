// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U37_HEADER_REVEAL_SCENES } from './header-reveal';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
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
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U37_HEADER_REVEAL_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const revealHeader = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>('[data-slot="reveal-header"]');
  if (header === null) {
    throw new Error('the Branch page has no reveal header');
  }
  return header;
};

describe('u37 header reveal scenes', () => {
  it('registers every scene', () => {
    Object.keys(U37_HEADER_REVEAL_SCENES).forEach((id) => {
      expect(MOCK_SCENES[id]).toBeDefined();
    });
  });

  it.each(Object.keys(U37_HEADER_REVEAL_SCENES))(
    'draws %s with the back row pinned above the header that steps aside',
    async (id) => {
      mount({ id });

      const back = await screen.findByRole('button', { name: 'Back to overview' });
      const title = await screen.findByRole('heading', { level: 1 });
      expect(revealHeader().contains(title)).toBe(true);
      expect(revealHeader().contains(back)).toBe(false);
      await waitFor(() => expect(document.querySelector('[data-page-scroller]')).not.toBeNull());
    },
  );
});
