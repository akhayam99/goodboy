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
import { NAMES } from '../../../../../shared/utils/names';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { GuideScene } from '../audit/GuideScene';
import { U34_HELP_SCENES } from './help';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
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

describe('the Help scenes', () => {
  it('registers the scene', () => {
    Object.entries(U34_HELP_SCENES).forEach(([id, Scene]) => expect(MOCK_SCENES[id]).toBe(Scene));
  });

  it('the guide scene leaves the same way as the other Help scenes', async () => {
    render(
      <ToastProvider>
        <GuideScene />
      </ToastProvider>,
    );

    await screen.findByRole('button', { name: /^Back to app/ }, WAIT);
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  });

  it('u34-help-search lists results from the guide and the releases together', async () => {
    const Scene = U34_HELP_SCENES['u34-help-search'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(
      () => expect(screen.getAllByRole('list', { name: 'Help results' })).toHaveLength(1),
      WAIT,
    );
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '');
    expect(labels.some((label) => label.endsWith(', Guide'))).toBe(true);
    expect(
      labels.filter((label) => label.endsWith(`, ${NAMES.whatsNew}`)).length,
    ).toBeLessThanOrEqual(3);
    const guideList = screen.getByRole('list', { name: 'Help results' });
    expect(guideList.textContent).toContain(' · ');
  });
});
