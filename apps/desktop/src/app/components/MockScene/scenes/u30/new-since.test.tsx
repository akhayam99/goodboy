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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U30_NEW_SINCE_SCENES } from './new-since';

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

const show = async () => {
  const Scene = U30_NEW_SINCE_SCENES['u30-new-since'];
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

describe('the u30 new since scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES['u30-new-since']).toBe(U30_NEW_SINCE_SCENES['u30-new-since']);
  });

  it('draws no New since bar and marks the new branch with a dot', async () => {
    const { container } = await show();

    expect(container.querySelector('[data-overview-card="new-since"]')).toBeNull();
    expect(container.querySelector('[data-slot="branch-board"]')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = await show();

    const { violations } = await runA11yCheck(container);

    expect(violations).toEqual([]);
  });
});
