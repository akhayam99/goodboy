import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import userEvent from '@testing-library/user-event';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const toolButton = (): Promise<HTMLElement> => screen.findByTestId('pane-toggle-scripts');

const sidePanel = (): HTMLElement => screen.getByRole('complementary', { name: 'Side panel' });

const searchInput = (): Promise<HTMLElement> =>
  screen.findByRole('combobox', { name: /search/i }, WAIT);

const escapeInSearch = async (): Promise<void> => {
  (await searchInput()).focus();
  await userEvent.keyboard('{Escape}');
  await settle();
};

const openScriptsThenPalette = async (): Promise<void> => {
  const tool = await toolButton();
  tool.focus();
  pressShortcut({ id: 'lens.scripts' });
  await settle();
  await waitFor(() => {
    expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('scripts');
  }, WAIT);
  pressShortcut({ id: 'palette.open' });
  await settle();
  await searchInput();
};

const expectScriptsStillOpen = (): void => {
  expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('scripts');
  expect(sidePanel().getAttribute('data-drawer-mode')).not.toBe('closed');
};

const expectPaletteGone = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByRole('combobox', { name: /search/i })).toBeNull();
  }, WAIT);
};

export const LAYERS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'scripts under the palette: Esc in the search box closes only the palette',
    covers: ['key:lens.scripts', 'key:palette.open', 'layers:palette-over-ask'],
    open: openScriptsThenPalette,
    lands: async () => {
      await escapeInSearch();
      await expectPaletteGone();
      expectScriptsStillOpen();
    },
  },
  {
    name: 'scripts under the palette: focus after Esc is on the page body today, not the panel',
    covers: ['layers:palette-focus-return'],
    open: async () => {
      await openScriptsThenPalette();
      const [option] = await screen.findAllByRole('option', {}, WAIT);
      expect(option).toBeDefined();
      fireEvent.mouseEnter(option ?? document.body);
      await settle();
      await escapeInSearch();
      await expectPaletteGone();
    },
    lands: async () => {
      expectScriptsStillOpen();
      expect(document.activeElement).toBe(document.body);
      expect(sidePanel().contains(document.activeElement)).toBe(false);
    },
  },
  {
    name: 'scripts under the palette: a second Esc closes the drawer',
    covers: ['layers:esc-twice'],
    open: async () => {
      await openScriptsThenPalette();
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
