import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, settle, useAppStore } from './harness';

const DRAFT = 'why is the build red on payments-api';

const composer = (): Promise<HTMLTextAreaElement> =>
  screen.findByRole('textbox', { name: 'Ask about this session' }) as Promise<HTMLTextAreaElement>;

const pressEscape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle();
};

const openedKind = (): string | null => selectOpenDrawer(useAppStore.getState())?.kind ?? null;

const openAsk = async (): Promise<void> => {
  pressShortcut({ id: 'ask.open' });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('ask'), WAIT);
};

export const DRAWER_CHROME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'ask draft: type, Esc, Esc, ⌘L brings the draft back and the composer has focus',
    covers: ['key:ask.open', 'openAsk'],
    open: async () => {
      await openAsk();
      const field = await composer();
      await waitFor(() => expect(document.activeElement).toBe(field), WAIT);
      fireEvent.change(field, { target: { value: DRAFT } });
      await settle();
      expect(field.value).toBe(DRAFT);
    },
    lands: async () => {
      await pressEscape();
      expect(openedKind()).toBe('ask');
      expect(document.activeElement).not.toBe(await composer());

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);

      await openAsk();
      const reopened = await composer();
      expect(reopened.value).toBe(DRAFT);
      await waitFor(() => expect(document.activeElement).toBe(reopened), WAIT);
    },
  },
  {
    name: 'ask drawer: an empty composer closes on the first Esc and the header says Close',
    covers: ['key:ask.open', 'openAsk'],
    open: async () => {
      await openAsk();
      await composer();
    },
    lands: async () => {
      const region = await screen.findByRole('region', { name: 'Ask' });
      expect(region.querySelector('header')?.textContent).not.toMatch(/Harborline|Northwind/);
      expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();

      await pressEscape();

      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
];
