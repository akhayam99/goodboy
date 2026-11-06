// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
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
import { U36_OVERVIEW_SCENES } from './overview';

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

afterEach(cleanup);

type ShowParams = { readonly name: string };

const show = async ({ name }: ShowParams) => {
  const Scene = U36_OVERVIEW_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown u36 overview scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const glance = () => document.querySelector('[data-overview-glance]');

describe('the u36 overview scenes', () => {
  it('registers a light and a dark scene for each state', () => {
    expect(Object.keys(U36_OVERVIEW_SCENES)).toEqual([
      'u36-p15-next-only-light',
      'u36-p15-next-only-dark',
      'u36-p15-needs-you-light',
      'u36-p15-needs-you-dark',
    ]);
  });

  it.each(['light', 'dark'])(
    'u36-p15-next-only-%s names the next step in the line and fills the one Next row',
    async (theme) => {
      await show({ name: `u36-p15-next-only-${theme}` });

      expect(glance()?.getAttribute('data-overview-glance')).toBe('next');
      expect(glance()?.textContent).toMatch(/^Next: /);
      expect(document.body.textContent).not.toContain('Nothing needs you');
      expect(
        document.querySelectorAll('[data-central-column] [data-variant="primary"]'),
      ).toHaveLength(1);
    },
  );

  it.each(['light', 'dark'])(
    'u36-p15-needs-you-%s counts what waits and keeps one filled button',
    async (theme) => {
      await show({ name: `u36-p15-needs-you-${theme}` });

      expect(glance()?.getAttribute('data-overview-glance')).toBe('waiting');
      expect(
        document.querySelectorAll('[data-central-column] [data-variant="primary"]'),
      ).toHaveLength(1);
    },
  );
});
