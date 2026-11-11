// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  it('registers every state in light and dark for the capture', () => {
    expect(Object.keys(BROWSER_PANE_SCENES).sort()).toEqual([
      'browser-page',
      'browser-page-dark',
      'browser-pane',
      'browser-pane-address',
      'browser-pane-address-dark',
      'browser-pane-dark',
      'browser-pane-field',
      'browser-pane-field-dark',
      'browser-pane-keys',
      'browser-pane-keys-dark',
      'browser-pane-loading',
      'browser-pane-loading-dark',
      'browser-pane-more',
      'browser-pane-more-dark',
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
    const pill = within(pane).getByRole('button', { name: 'Edit address, Checkout' });
    expect(pill.textContent).toContain('localhost:5173');
    expect(within(pane).queryByRole('combobox', { name: 'Address or search' })).toBeNull();
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
    expect(groups).toEqual(['session', 'session', 'pins']);
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
    within(page).getByRole('button', { name: 'Edit address, Checkout' });
  });

  it('shows the address being edited, selected, under the pill', async () => {
    mount({ id: 'browser-pane-address' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const field = await within(pane).findByRole('combobox', { name: 'Address or search' }, WAIT);
    expect(field).toHaveProperty('value', 'http://localhost:5173/checkout');
    expect(within(pane).queryByRole('button', { name: /^Edit address/ })).toBeNull();
  });

  it('opens the command field under the row with a typed word, its tabs and a visit', async () => {
    mount({ id: 'browser-pane-field' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = await within(pane).findByRole('listbox', { name: 'Suggestions' }, WAIT);
    await within(list).findByRole('option', { name: 'Confirm order' }, WAIT);
    expect(within(pane).getByRole('combobox', { name: 'Address or search' })).toHaveProperty(
      'value',
      'check',
    );
    expect(
      within(list)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Tabs', 'Visited']);
    expect(within(list).getByRole('option', { name: 'Staging checkout' }).textContent).toContain(
      'Pinned',
    );
  });

  it('shows the page loading with a line under the row, Stop, a fetched icon and a Forward that is off', async () => {
    mount({ id: 'browser-pane-loading' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    within(pane).getByRole('progressbar', { name: 'Loading page' });
    within(pane).getByRole('button', { name: 'Stop' });
    expect(within(pane).queryByRole('button', { name: 'Reload' })).toBeNull();
    const pill = within(pane).getByRole('button', { name: 'Edit address, Checkout' });
    await waitFor(() => expect(pill.querySelector('img')).not.toBeNull(), WAIT);
    await waitFor(
      () =>
        expect(within(pane).getByRole('button', { name: 'Forward' }).hasAttribute('disabled')).toBe(
          true,
        ),
      WAIT,
    );
    expect(within(pane).getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(false);
  });

  it('opens the More menu with its five rows', async () => {
    mount({ id: 'browser-pane-more' });

    const menu = await screen.findByRole('menu', undefined, WAIT);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(5);
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
    within(list).getByText(/^Pinned for /);
    within(list).getByText('Tabs close when the session is archived.');
    expect(
      within(pane).getByRole('button', { name: 'Hide tab list' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('lists the tabs of every session and the pins in the palette, each with its place', async () => {
    mount({ id: 'browser-pane-keys' });

    const dialog = await screen.findByRole('dialog', {}, WAIT);
    await within(dialog).findByText('PR #318', {}, WAIT);
    within(dialog).getByText('Tax rates');
    within(dialog).getByText('Staging checkout');
    within(dialog).getByText('Pinned');
    expect(within(dialog).getAllByText('Browser tab')).toHaveLength(2);
  });
});
