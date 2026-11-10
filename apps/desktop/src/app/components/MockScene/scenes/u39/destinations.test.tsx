// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listSessionTitlesAcrossWorkspaces: async () => [],
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { DESTINATIONS } from '../../../../../shared/navigation/destinations';
import { MOCK_SCENES } from '../..';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U39_DESTINATIONS_SCENES } from './destinations';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = () => {
  const Scene = U39_DESTINATIONS_SCENES['u39-destinations'];
  if (Scene === undefined) {
    throw new Error('no scene u39-destinations');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  ).container;
};

describe('the destination sheet scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U39_DESTINATIONS_SCENES)).toEqual(['u39-destinations']);
    expect(MOCK_SCENES['u39-destinations']).toBe(U39_DESTINATIONS_SCENES['u39-destinations']);
  });

  it('shows the same word for a destination in every channel that names it', async () => {
    const container = mount();

    await waitFor(() =>
      expect(container.querySelectorAll('tr[data-destination]')).toHaveLength(DESTINATIONS.length),
    );
    const rows = Array.from(container.querySelectorAll<HTMLElement>('tr[data-destination]'));
    rows.forEach((row) => {
      const [column = '', menuBar = '', palette = ''] = within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? '');
      const label = row.querySelector('th')?.textContent ?? '';
      const destination = DESTINATIONS.find((candidate) => candidate.label === label);
      expect(column.startsWith(label)).toBe(true);
      expect(menuBar).toBe(destination?.menuId === undefined ? '' : label);
      expect(palette.startsWith(label)).toBe(true);
    });
  });

  it('draws the same glyph in the column cell and the palette cell', async () => {
    const container = mount();

    await waitFor(() =>
      expect(container.querySelectorAll('tr[data-destination]')).toHaveLength(DESTINATIONS.length),
    );
    const rows = Array.from(container.querySelectorAll<HTMLElement>('tr[data-destination]'));
    rows.forEach((row) => {
      const [column, , palette] = within(row).getAllByRole('cell');
      const columnGlyph = column?.querySelector('svg')?.innerHTML ?? '';
      const paletteGlyph = palette?.querySelector('svg')?.innerHTML ?? '';
      expect(columnGlyph).not.toBe('');
      expect(paletteGlyph).toBe(columnGlyph);
    });
  });

  it('lists the former names the palette answers to', async () => {
    const container = mount();

    await waitFor(() =>
      expect(container.querySelectorAll('tr[data-destination]')).toHaveLength(DESTINATIONS.length),
    );
    const board = container.querySelector<HTMLElement>('tr[data-destination="board"]');
    expect(board?.textContent).toContain('Sessions');
  });

  it('has no accessibility violation', async () => {
    const container = mount();
    await waitFor(() =>
      expect(container.querySelectorAll('tr[data-destination]')).toHaveLength(DESTINATIONS.length),
    );
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
