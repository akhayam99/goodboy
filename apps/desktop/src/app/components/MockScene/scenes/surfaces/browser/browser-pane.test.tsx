// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeXml, Terminal } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
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

const PATH_DATA = / d="[^"]+"/g;

type MountParams = {
  readonly id: string;
};

type MarkupParams = {
  readonly markup: string;
};

const pathsOf = ({ markup }: MarkupParams): string => (markup.match(PATH_DATA) ?? []).join('');

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
      'browser-console',
      'browser-console-dark',
      'browser-handoff',
      'browser-handoff-dark',
      'browser-page',
      'browser-page-dark',
      'browser-pane',
      'browser-pane-address',
      'browser-pane-address-dark',
      'browser-pane-cover',
      'browser-pane-cover-dark',
      'browser-pane-dark',
      'browser-pane-field',
      'browser-pane-field-dark',
      'browser-pane-find',
      'browser-pane-find-dark',
      'browser-pane-find-missing',
      'browser-pane-find-missing-dark',
      'browser-pane-keys',
      'browser-pane-keys-dark',
      'browser-pane-loading',
      'browser-pane-loading-dark',
      'browser-pane-more',
      'browser-pane-more-dark',
      'browser-pane-passkey',
      'browser-pane-passkey-dark',
      'browser-pane-saved-copy',
      'browser-pane-saved-copy-dark',
      'browser-pane-tabs',
      'browser-pane-tabs-dark',
      'browser-peek',
      'browser-peek-dark',
      'browser-pick',
      'browser-pick-dark',
      'browser-width-phone',
      'browser-width-tablet',
    ]);
    for (const [id, Scene] of Object.entries(BROWSER_PANE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('opens the browser beside the session with its tabs in the address row', async () => {
    mount({ id: 'browser-pane' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const strip = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    const pill = within(strip).getByRole('button', {
      name: 'Edit address, Checkout, localhost:5173',
    });
    expect(pill.textContent).toContain('localhost:5173');
    expect(pill.getAttribute('aria-current')).toBe('page');
    expect(within(pane).queryByRole('combobox', { name: 'Address or search' })).toBeNull();
    within(strip).getByRole('button', { name: 'Staging checkout, pinned' });
    expect(pane.querySelector('[data-browser-row]')?.contains(strip)).toBe(true);
    expect(screen.getAllByTestId('pane-toggle-browser')[0]?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it.each(['browser-pane', 'browser-pane-dark'])(
    'draws one selected surface on the shown tab, never a pill inside it (%s)',
    async (id) => {
      mount({ id });

      const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
      const strip = within(pane).getByRole('navigation', { name: 'Browser tabs' });
      const shown = within(strip).getByRole('button', { name: /^Edit address, Checkout/ });
      expect(shown.getAttribute('data-browser-tab')).toBe('active');
      expect(shown.getAttribute('aria-current')).toBe('page');
      expect(shown.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
      expect(strip.querySelectorAll('[data-browser-tab="active"]')).toHaveLength(1);
    },
  );

  it.each(['browser-console', 'browser-console-dark'])(
    'gives the console toggle its own icon, not the terminal one (%s)',
    async (id) => {
      mount({ id });

      await screen.findByRole('region', { name: 'Console' }, WAIT);
      const toggle = screen.getByRole('button', { name: 'Console' }).querySelector('svg');
      const drawn = pathsOf({ markup: toggle?.outerHTML ?? '' });
      expect(drawn).toBe(pathsOf({ markup: renderToStaticMarkup(<CodeXml />) }));
      expect(drawn).not.toBe(pathsOf({ markup: renderToStaticMarkup(<Terminal />) }));
      expect(drawn).not.toBe(pathsOf({ markup: renderToStaticMarkup(<CONCEPT_ICONS.terminal />) }));
    },
  );

  it('opens the console under the page with a row per level and the failed request', async () => {
    mount({ id: 'browser-console' });

    const region = await screen.findByRole('region', { name: 'Console' }, WAIT);
    await waitFor(
      () => expect(region.querySelectorAll('[data-console-level]')).toHaveLength(4),
      WAIT,
    );
    expect(
      Array.from(region.querySelectorAll('[data-console-level]'), (node) =>
        node.getAttribute('data-console-level'),
      ),
    ).toEqual(['error', 'warn', 'info', 'log']);
    expect(within(region).getByRole('tab', { name: /Network/ }).textContent).toBe('Network3');
    expect(screen.getByRole('button', { name: 'Console' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('picks the pay button and opens the note under the row', async () => {
    mount({ id: 'browser-pick' });

    const note = await screen.findByRole('group', { name: 'Note for the picked element' }, WAIT);
    expect(note.textContent).toContain('<PayButton>  src/checkout/PayButton.tsx:42');
    expect(within(note).getByRole('textbox', { name: 'What should change?' })).toBeTruthy();
    expect(within(note).getByRole('button', { name: 'Add to message' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Select an element' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('frames the page at the width of the phone and tablet presets', async () => {
    mount({ id: 'browser-width-phone' });
    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const frame = pane.querySelector('[data-device-frame]');
    expect(frame?.getAttribute('style')).toContain('max-width: 408px');
    cleanup();

    mount({ id: 'browser-width-tablet' });
    const tabletPane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    expect(tabletPane.querySelector('[data-device-frame]')?.getAttribute('style')).toContain(
      'max-width: 786px',
    );
  });

  it('shows a saved report in a tab beside the session', async () => {
    mount({ id: 'browser-pane-saved-copy' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const pill = within(pane).getByRole('button', { name: /^Edit address, Rounding drift/ });
    expect(pill.textContent).toContain('index.html');
  });

  it('opens the Browser page with every tab grouped by session and the Browser tool selected', async () => {
    mount({ id: 'browser-page' });

    const list = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        '[data-browser-page] nav[aria-label="Browser tabs"]',
      );
      if (found === null) {
        throw new Error('The Browser page draws no tab row yet.');
      }
      return found;
    }, WAIT);
    await within(list).findByRole('button', { name: 'PR #318' }, WAIT);
    const groups = Array.from(list.querySelectorAll('[data-browser-group]')).map((group) =>
      group.getAttribute('data-browser-group'),
    );
    expect(groups).toEqual(['pins', 'session', 'session']);
    within(list).getByRole('button', { name: 'Fix the rounding drift' });
    expect(screen.queryByRole('navigation', { name: 'Tabs by session' })).toBeNull();
    expect(
      within(list)
        .getByRole('button', { name: /^Edit address, Checkout/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      document.querySelector('[data-testid="pane-toggle-browser"]')?.getAttribute('aria-current'),
    ).toBe('page');
    const page = list.closest<HTMLElement>('[data-studio-slot]');
    if (page === null) {
      throw new Error('The Browser page sits in no studio slot.');
    }
    within(page).getByRole('button', { name: 'Edit address, Checkout, localhost:5173' });
  });

  it('shows the address being edited, selected, under the pill', async () => {
    mount({ id: 'browser-pane-address' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const field = await within(pane).findByRole('combobox', { name: 'Address or search' }, WAIT);
    expect(field).toHaveProperty('value', 'http://localhost:5173/checkout');
    expect(within(pane).queryByRole('button', { name: /^Edit address/ })).toBeNull();
  });

  it.each(['browser-pane-field', 'browser-pane-field-dark'])(
    'floats the suggestions for a typed word over the page, anchored to the row (%s)',
    async (id) => {
      mount({ id });

      const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
      const list = await screen.findByRole('listbox', { name: 'Suggestions' }, WAIT);
      await within(list).findByRole('option', { name: 'Confirm order' }, WAIT);
      expect(pane.contains(list)).toBe(false);
      expect(list.closest('[data-anchored-layer]')).not.toBeNull();
    },
  );

  it('lists the tabs and a visit for a typed word', async () => {
    mount({ id: 'browser-pane-field' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = await screen.findByRole('listbox', { name: 'Suggestions' }, WAIT);
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

  it('opens the find bar under the row with a typed word that the page has', async () => {
    mount({ id: 'browser-pane-find' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const bar = await within(pane).findByRole('search', { name: 'Find in page' }, WAIT);
    await waitFor(
      () =>
        expect(within(bar).getByRole('textbox', { name: 'Find in page' })).toHaveProperty(
          'value',
          'retry',
        ),
      WAIT,
    );
    await waitFor(() => expect(within(bar).getByRole('status').textContent).toBe('Found'), WAIT);
    within(bar).getByRole('button', { name: 'Done' });
  });

  it('opens the find bar with a typed word that the page does not have', async () => {
    mount({ id: 'browser-pane-find-missing' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const bar = await within(pane).findByRole('search', { name: 'Find in page' }, WAIT);
    await waitFor(
      () => expect(within(bar).getByRole('status').textContent).toBe('Not found'),
      WAIT,
    );
  });

  it('shows the page loading with a line under the row, Stop, a fetched icon and a Forward that is off', async () => {
    mount({ id: 'browser-pane-loading' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    within(pane).getByRole('progressbar', { name: 'Loading page' });
    within(pane).getByRole('button', { name: 'Stop' });
    expect(within(pane).queryByRole('button', { name: 'Reload' })).toBeNull();
    const pill = within(pane).getByRole('button', {
      name: 'Edit address, Checkout, localhost:5173',
    });
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

  it('opens the More menu with its seven rows', async () => {
    mount({ id: 'browser-pane-more' });

    const menu = await screen.findByRole('menu', undefined, WAIT);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(7);
  });

  it('opens the More menu on the Add to message row first', async () => {
    mount({ id: 'browser-handoff' });

    const menu = await screen.findByRole('menu', undefined, WAIT);
    expect(within(menu).getAllByRole('menuitem')[0]?.textContent).toContain('Add to message');
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

  it('says a sign-in asked for a passkey above the tab it belongs to', async () => {
    mount({ id: 'browser-pane-passkey' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const pill = await within(pane).findByRole('button', { name: /^Edit address/ }, WAIT);
    expect(pill.textContent).toContain('id.cascadia.dev');
    const title = await within(pane).findByText(
      "Passkeys don't work in Goodboy's browser",
      {},
      WAIT,
    );
    const notice = title.closest<HTMLElement>('[role="status"]');
    if (notice === null) {
      throw new Error('The passkey notice has no status region.');
    }
    within(notice).getByRole('button', { name: 'Open in your browser' });
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }));

    await waitFor(
      () => expect(screen.queryByText("Passkeys don't work in Goodboy's browser")).toBeNull(),
      WAIT,
    );
  });

  it('keeps many tabs in the one row, the inactive ones shrinkable to their icon', async () => {
    mount({ id: 'browser-pane-tabs' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    const inactive = list.querySelectorAll('[data-browser-tab="tab"]');
    expect(inactive).toHaveLength(5);
    within(list).getByRole('button', { name: 'Acme invoices' });
    within(list).getByRole('group', { name: /^Pinned · / });
    expect(list.closest('.overflow-x-auto')).not.toBeNull();
    expect(within(pane).queryByRole('button', { name: /tab list$/ })).toBeNull();
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

  it('opens a menu over the page for the cover capture', async () => {
    mount({ id: 'browser-pane-cover' });

    await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const menu = await screen.findByRole('menu', { name: 'Page actions' }, WAIT);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  });

  it('marks the sleeping tab in the row and shows the pin as a square icon', async () => {
    mount({ id: 'browser-pane' });

    const pane = await screen.findByRole('region', { name: 'Browser' }, WAIT);
    const list = within(pane).getByRole('navigation', { name: 'Browser tabs' });
    await within(list).findByRole('button', { name: 'Tax rates, asleep' }, WAIT);
    const pin = within(list).getByRole('button', { name: 'Staging checkout, pinned' });
    expect(pin.closest('[data-browser-tab]')?.getAttribute('data-browser-tab')).toBe('pin');
    expect(within(pin).queryByText('Staging checkout')).toBeNull();
  });
});
