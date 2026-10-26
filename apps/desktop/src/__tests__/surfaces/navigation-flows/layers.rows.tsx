import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import userEvent from '@testing-library/user-event';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const askButton = (): Promise<HTMLElement> => screen.findByTestId('pane-toggle-ask');

const sidePanel = (): HTMLElement => screen.getByRole('complementary', { name: 'Side panel' });

const searchInput = (): Promise<HTMLElement> =>
  screen.findByRole('combobox', { name: /search/i }, WAIT);

const escapeInSearch = async (): Promise<void> => {
  (await searchInput()).focus();
  await userEvent.keyboard('{Escape}');
  await settle();
};

const openAskThenPalette = async (): Promise<void> => {
  const ask = await askButton();
  ask.focus();
  pressShortcut({ id: 'ask.open' });
  await settle();
  await waitFor(() => {
    expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('ask');
  }, WAIT);
  pressShortcut({ id: 'palette.open' });
  await settle();
  await searchInput();
};

const expectAskStillOpen = (): void => {
  expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('ask');
  expect(sidePanel().getAttribute('data-drawer-mode')).not.toBe('closed');
};

const expectPaletteGone = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByRole('combobox', { name: /search/i })).toBeNull();
  }, WAIT);
};

export const LAYERS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'ask under the palette: Esc in the search box closes only the palette',
    covers: ['key:ask.open', 'key:palette.open', 'layers:palette-over-ask'],
    open: openAskThenPalette,
    lands: async () => {
      await escapeInSearch();
      await expectPaletteGone();
      expectAskStillOpen();
    },
  },
  {
    name: 'ask under the palette: focus after Esc is on the page body today, not the composer',
    covers: ['layers:palette-focus-return'],
    open: async () => {
      await openAskThenPalette();
      const [option] = await screen.findAllByRole('option', {}, WAIT);
      expect(option).toBeDefined();
      fireEvent.mouseEnter(option ?? document.body);
      await settle();
      await escapeInSearch();
      await expectPaletteGone();
    },
    lands: async () => {
      expectAskStillOpen();
      expect(document.activeElement).toBe(document.body);
      expect(sidePanel().contains(document.activeElement)).toBe(false);
    },
  },
  {
    name: 'ask under the palette: a second Esc closes the drawer',
    covers: ['layers:esc-twice'],
    open: async () => {
      await openAskThenPalette();
      await escapeInSearch();
      await expectPaletteGone();
    },
    lands: async () => {
      await userEvent.keyboard('{Escape}');
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
      }, WAIT);
    },
  },
];
