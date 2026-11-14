import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const toolButton = (): Promise<HTMLElement> => screen.findByTestId('pane-toggle-scripts');

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
    name: 'scripts over a narrow page: its chord opens it over a scrim, a scrim click closes it, focus returns to Scripts',
    covers: ['key:lens.scripts'],
    open: async () => {
      const tool = await toolButton();
      tool.focus();
      expect(document.activeElement).toBe(tool);
      pressShortcut({ id: 'lens.scripts' });
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('scripts');
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('overlay');
      }, WAIT);
      expect(scrimOf()).not.toBeNull();
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(true);
    },
    lands: async () => {
      fireEvent.click(scrimOf() as HTMLElement);
      expect(scrimOf()?.className).toContain('pointer-events-none');
      await settle();
      await waitFor(() => {
        expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
        expect(sidePanel().getAttribute('data-drawer-mode')).toBe('closed');
      }, WAIT);
      expect(pageUnderDrawer().hasAttribute('inert')).toBe(false);
      await waitFor(() => {
        expect(scrimOf()).toBeNull();
      }, WAIT);
      expect(document.activeElement).toBe(await toolButton());
    },
  },
];
