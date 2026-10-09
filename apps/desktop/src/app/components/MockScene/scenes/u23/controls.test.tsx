// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { U23_CONTROLS_SCENES } from './controls';

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  window.history.replaceState(null, '', '/?scene=shell');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U23_CONTROLS_SCENES;

const renderScene = (id: SceneId) => {
  const Scene = U23_CONTROLS_SCENES[id];
  return render(<Scene />);
};

const rowOf = (name: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-scene-row="${name}"]`);
  if (row === null) {
    throw new Error(`no row ${name}`);
  }
  return row;
};

const sizesIn = (row: HTMLElement): ReadonlyArray<string | null> =>
  [...row.querySelectorAll('button')].map((button) => button.getAttribute('data-size'));

describe('controls ladder', () => {
  it('draws every button of a row at the size the row names', () => {
    renderScene('controls-ladder');

    for (const size of ['xs', 'sm', 'md']) {
      const sizes = sizesIn(rowOf(`Button ${size}`));
      expect(sizes.length).toBe(9);
      expect(new Set(sizes)).toEqual(new Set([size]));
    }
  });

  it('shows the disabled buttons as disabled, in every size', () => {
    renderScene('controls-ladder');

    for (const size of ['xs', 'sm', 'md']) {
      const disabled = [...rowOf(`Button ${size}`).querySelectorAll('button:disabled')];
      expect(disabled).toHaveLength(3);
    }
  });

  it('draws the icon buttons at xs, sm and md and the outline one with its border', () => {
    renderScene('controls-ladder');

    const row = rowOf('Icon buttons xs, sm, md');
    expect(sizesIn(row)).toEqual(['xs', 'sm', 'md', 'sm', 'sm']);
    expect(
      within(row).getByRole('button', { name: 'Pin Northwind' }).getAttribute('data-variant'),
    ).toBe('outline');
    expect(
      within(row)
        .getByRole('button', { name: 'Refresh payments-api' })
        .getAttribute('data-variant'),
    ).toBe('ghost');
  });

  it('shows the four chip kinds', () => {
    renderScene('controls-ladder');

    const row = rowOf('Chips by kind');
    expect(within(row).getByText('Merged')).toBeDefined();
    expect(within(row).getByText('Context')).toBeDefined();
    expect(within(row).getByText('a1b2c3d')).toBeDefined();
    expect(within(row).getByText('3')).toBeDefined();
  });

  it('keeps a header action row, a list row and a toolbar on the ladder', () => {
    renderScene('controls-ladder');

    const header = rowOf('Header action row');
    expect(within(header).getByRole('tablist').getAttribute('data-size')).toBe('xs');
    expect(new Set(sizesIn(header).filter((size) => size !== null))).toEqual(new Set(['sm']));
    expect(new Set(sizesIn(rowOf('List row actions')))).toEqual(new Set(['xs']));
    expect(new Set(sizesIn(rowOf('Toolbar')))).toEqual(new Set(['sm']));
  });
});

describe('controls fields', () => {
  it('draws Input at sm by default and md when asked', () => {
    renderScene('controls-fields');

    const row = rowOf('Input sm and md');
    expect(
      within(row).getByRole('textbox', { name: 'Branch name' }).getAttribute('data-size'),
    ).toBe('sm');
    expect(
      within(row).getByRole('textbox', { name: 'Branch name, medium' }).getAttribute('data-size'),
    ).toBe('md');
  });

  it('clears a search field with its own button', () => {
    renderScene('controls-fields');

    const row = rowOf('Search field, empty and filled');
    const settings = within(row).getByRole('searchbox', { name: 'Search settings' });
    expect((settings as HTMLInputElement).value).toBe('webhook');
    fireEvent.click(within(row).getByRole('button', { name: 'Clear search' }));
    expect(
      (within(row).getByRole('searchbox', { name: 'Search settings' }) as HTMLInputElement).value,
    ).toBe('');
    expect(within(row).queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('names each switch after its setting and shows no state word', () => {
    renderScene('controls-fields');

    const row = rowOf('Switch names the setting');
    for (const name of ['Parallel agents', 'Attribution line']) {
      const toggle = within(row).getByRole('switch', { name });
      expect(toggle.textContent).toBe('');
    }
    expect(within(row).queryByText('On')).toBeNull();
    expect(within(row).queryByText('Off')).toBeNull();
  });

  it('flips a switch from the keyboard target', () => {
    renderScene('controls-fields');

    const toggle = within(rowOf('Switch names the setting')).getByRole('switch', {
      name: 'Attribution line',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('draws the segmented controls at xs and sm', () => {
    renderScene('controls-fields');

    const row = rowOf('Segmented xs and sm');
    expect(
      within(row).getByRole('tablist', { name: 'Activity view' }).getAttribute('data-size'),
    ).toBe('xs');
    expect(within(row).getByRole('tablist', { name: 'Branch tab' }).getAttribute('data-size')).toBe(
      'sm',
    );
  });
});

describe('controls hints', () => {
  it('reads Ask and Search the same way: the word, then the chord as bare text', () => {
    renderScene('controls-hints');

    const row = rowOf('Ask and Search side by side');
    const ask = within(row).getByTestId('ask-trail-button');
    const search = within(row).getByRole('button', { name: /^Search \(/ });
    expect(ask.querySelector('kbd')?.getAttribute('data-look')).toBe('inline');
    expect(search.querySelector('kbd')?.getAttribute('data-look')).toBe('inline');
    expect(ask.querySelector('kbd')?.textContent).toBe(shortcutGlyphs('ask.open'));
    expect(search.querySelector('kbd')?.textContent).toBe(shortcutGlyphs('palette.open'));
  });

  it('keeps the small cap for a single key and goes bare for a chord, in a filled button', () => {
    renderScene('controls-hints');

    const row = rowOf('Filled button with a single key');
    const single = within(row).getByRole('button', { name: /^Fix 3 comments/ });
    const chord = within(row).getByRole('button', { name: /^Start Scout/ });
    expect(single.querySelector('kbd')?.getAttribute('data-look')).toBe('cap');
    expect(chord.querySelector('kbd')?.getAttribute('data-look')).toBe('inline');
    expect(single.querySelector('kbd')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('controls topbar', () => {
  it('mounts the real top bar with the bell badge and the nav arrows', async () => {
    renderScene('controls-topbar');

    await screen.findByRole('button', { name: /^Notifications, 3 unread/ });
    expect(document.querySelector('[data-top-bar]')).not.toBeNull();
    expect(document.querySelector('[data-nav-arrow="back"]')).not.toBeNull();
    expect(document.querySelector('[data-nav-arrow="forward"]')).not.toBeNull();
  });
});
