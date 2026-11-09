// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { BROWSER_PANE_SCENES } from './browser-pane';

const WAIT = { timeout: 15_000 };

type MountParams = {
  readonly id: string;
};

beforeAll(async () => {
  await importStore();
  installFakeResizeObserver();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
  clearSceneInvoke();
});

const mount = ({ id }: MountParams) => {
  const Scene = BROWSER_PANE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the browser pane scenes', () => {
  it('registers both states in light and dark for the capture', () => {
    expect(Object.keys(BROWSER_PANE_SCENES).sort()).toEqual([
      'browser-pane',
      'browser-pane-dark',
      'browser-pane-tabs',
      'browser-pane-tabs-dark',
    ]);
    for (const [id, Scene] of Object.entries(BROWSER_PANE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('opens the browser beside the session with its tabs in a strip', async () => {
    mount({ id: 'browser-pane' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    expect(within(pane).getByRole('textbox', { name: 'Address' })).toHaveProperty(
      'value',
      'http://localhost:5173/checkout',
    );
    const strip = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    expect(
      within(strip).getByRole('button', { name: 'Checkout' }).getAttribute('aria-current'),
    ).toBe('page');
    within(strip).getByRole('button', { name: 'Staging checkout, pinned' });
    expect(screen.getAllByTestId('pane-toggle-browser')[0]?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('lists the session tabs and the project pins beside the page', async () => {
    mount({ id: 'browser-pane-tabs' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    within(list).getByText('This session');
    within(list).getByText(/^Pinned for /);
    within(list).getByText('Tabs close when the session is archived.');
    expect(
      within(pane).getByRole('button', { name: 'Hide tab list' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
