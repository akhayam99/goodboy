import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const toolButton = (): Promise<HTMLElement> => screen.findByTestId('pane-toggle-terminal');

const sidePanel = (): HTMLElement => screen.getByRole('complementary', { name: 'Side panel' });

const pageUnderDrawer = (): HTMLElement => {
  const page = document.querySelector<HTMLElement>('main [data-drawer-main]');
  expect(page).not.toBeNull();
  return page as HTMLElement;
};

const scrimOf = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-drawer-scrim]');

export const DRAWER_ROWS: ReadonlyArray<Row> = [
  {
    name: 'terminal over a narrow page: the Scripts chord opens it with the page still live, a page click leaves it open, Close closes it and focus leaves the panel',
    covers: ['key:lens.scripts'],
    open: async () => {
      const tool = await toolButton();
      tool.focus();
      expect(document.activeElement).toBe(tool);
      pressShortcut({ id: 'lens.scripts' });
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('terminal');
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('overlay');
      }, WAIT);
      expect(scrimOf()).toBeNull();
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(false);
    },
    lands: async () => {
      fireEvent.click(pageUnderDrawer());
      await settle();
      expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('terminal');
      const card = sidePanel().querySelector<HTMLElement>('[data-drawer-card]');
      if (card === null) {
        throw new Error('the terminal card is on screen');
      }
      const [close] = within(card).getAllByRole('button', { name: 'Close' });
      if (close === undefined) {
        throw new Error('the terminal card has a Close button');
      }
      fireEvent.click(close);
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('closed');
      }, WAIT);
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(false);
      expect(document.activeElement?.closest('[data-drawer-card]') ?? null).toBeNull();
    },
  },
];
