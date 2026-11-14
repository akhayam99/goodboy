import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { openLens } from '../../../features/session/openLens';
import { type Ctx, type Row, WAIT, settle, useAppStore } from './harness';

const DRAFT = 'why is the build red on payments-api';

const composer = (): Promise<HTMLTextAreaElement> =>
  screen.findByRole('textbox', { name: 'Ask about this session' }) as Promise<HTMLTextAreaElement>;

const pressEscape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle();
};

const openedKind = (): string | null => selectOpenDrawer(useAppStore.getState())?.kind ?? null;

const openAskDrawer = async ({ sessionId }: Ctx): Promise<void> => {
  useAppStore.getState().openDrawer({ kind: 'ask', sessionId, payload: null });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('ask'), WAIT);
};

const openContextOverAsk = async (ctx: Ctx): Promise<void> => {
  await openAskDrawer(ctx);
  await composer();
  useAppStore.getState().openDrawer({
    kind: 'context',
    sessionId: ctx.sessionId,
    payload: { section: 'goal', view: 'current' },
  });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('context'), WAIT);
};

export const DRAWER_CHROME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'slot: the drawer it replaced waits in a back chip, the chip swaps, Esc walks back',
    covers: ['openDrawer', 'closeDrawer'],
    open: openContextOverAsk,
    lands: async () => {
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Back to Ask' }));
      await settle();
      await waitFor(() => expect(openedKind()).toBe('ask'), WAIT);
      expect(await screen.findByRole('button', { name: 'Back to Context' })).toBeDefined();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBe('context'), WAIT);
      expect(screen.queryByRole('button', { name: /^Back to / })).toBeNull();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
  {
    name: 'slot: ⌘⇧W closes the top of the slot, then the drawer from the chip',
    covers: ['key:slot.close', 'closeDrawer'],
    open: openContextOverAsk,
    lands: async () => {
      pressShortcut({ id: 'slot.close' });
      await settle();
      await waitFor(() => expect(openedKind()).toBe('ask'), WAIT);

      pressShortcut({ id: 'slot.close', target: await composer() });
      await settle();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
  {
    name: 'ask draft: type, leave the tab, ⌘L brings the draft back and the composer has focus',
    covers: ['key:ask.open', 'openAsk'],
    open: async () => {
      pressShortcut({ id: 'ask.open' });
      await settle();
      const field = await composer();
      await waitFor(() => expect(document.activeElement).toBe(field), WAIT);
      fireEvent.change(field, { target: { value: DRAFT } });
      await settle();
      expect(field.value).toBe(DRAFT);
    },
    lands: async (ctx) => {
      openLens({ sessionId: ctx.sessionId, lens: null });
      await settle();
      expect(openedKind()).toBeNull();

      pressShortcut({ id: 'ask.open' });
      await settle();
      const reopened = await composer();
      expect(reopened.value).toBe(DRAFT);
      await waitFor(() => expect(document.activeElement).toBe(reopened), WAIT);
    },
  },
  {
    name: 'ask drawer: an empty composer closes on the first Esc and the header says Close',
    covers: ['openDrawer'],
    open: async (ctx) => {
      await openAskDrawer(ctx);
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
