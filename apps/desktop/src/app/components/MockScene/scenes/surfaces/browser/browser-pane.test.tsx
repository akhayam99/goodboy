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
      'browser-page',
      'browser-page-dark',
      'browser-pane',
      'browser-pane-dark',
      'browser-pane-rail',
      'browser-pane-rail-dark',
      'browser-pane-tabs',
      'browser-pane-tabs-dark',
      'browser-peek',
      'browser-peek-dark',
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

  it('opens the Browser page with every tab grouped by session and the Browser tool selected', async () => {
    mount({ id: 'browser-page' });

    const list = await screen.findByRole('navigation', { name: 'Tabs by session' }, WAIT);
    await within(list).findByRole('button', { name: 'PR #318' }, WAIT);
    const groups = Array.from(list.querySelectorAll('[data-browser-group]')).map((group) =>
      group.getAttribute('data-browser-group'),
    );
    expect(groups).toEqual(['pins', 'session', 'session']);
    expect(
      within(list).getByRole('button', { name: 'Checkout' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      document.querySelector('[data-testid="pane-toggle-browser"]')?.getAttribute('aria-current'),
    ).toBe('page');
    const page = list.closest<HTMLElement>('[data-studio-slot]');
    if (page === null) {
      throw new Error('The Browser page sits in no studio slot.');
    }
    expect(within(page).getByRole('textbox', { name: 'Address' })).toHaveProperty(
      'value',
      'http://localhost:5173/checkout',
    );
  });

  it('peeks a localhost link in a decision with the title of its open tab', async () => {
    mount({ id: 'browser-peek' });

    await screen.findByRole('link', { name: 'localhost:5173/checkout' }, WAIT);
    const card = await screen.findByTestId('browser-link-peek', undefined, WAIT);
    expect(card.textContent).toContain('Checkout');
    expect(card.textContent).toContain('http://localhost:5173/checkout');
    expect(card.textContent).toContain('Shows its tab beside the session.');
    expect(screen.queryByRole('region', { name: 'Browser' })).toBeNull();
  });

  it('lists the session tabs and the project pins beside the page', async () => {
    mount({ id: 'browser-pane-tabs' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    within(list).getByText('This session');
    within(list).getByText(/^Pinned · /);
    expect(within(list).queryByText('Tabs close when the session is archived.')).toBeNull();
    expect(
      within(pane).getByRole('button', { name: 'Hide tab list' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('marks the sleeping tab and folds the list to a rail of favicons', async () => {
    mount({ id: 'browser-pane-rail' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    expect(list.getAttribute('data-tab-list')).toBe('rail');
    await within(list).findByRole('button', { name: 'Tax rates, asleep' }, WAIT);
    within(list).getByRole('button', { name: 'Staging checkout, pinned' });
    expect(within(list).queryByText('Tax rates')).toBeNull();
  });
});
