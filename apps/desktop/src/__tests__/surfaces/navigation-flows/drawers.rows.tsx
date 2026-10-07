import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const askButton = (): Promise<HTMLElement> => screen.findByTestId('ask-trail-button');

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
    name: 'ask over a narrow page: ⌘L opens it over a scrim, a scrim click closes it, focus returns to Ask',
    covers: ['key:ask.open', 'openAsk'],
    open: async () => {
      const ask = await askButton();
      ask.focus();
      expect(document.activeElement).toBe(ask);
      pressShortcut({ id: 'ask.open' });
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('ask');
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('overlay');
      }, WAIT);
      expect(scrimOf()).not.toBeNull();
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(true);
    },
    lands: async () => {
      fireEvent.click(scrimOf() as HTMLElement);
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('closed');
      }, WAIT);
      expect(scrimOf()).toBeNull();
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(await askButton());
    },
  },
];
