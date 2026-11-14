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

const openScriptsDrawer = async ({ sessionId }: Ctx): Promise<void> => {
  useAppStore.getState().openDrawer({ kind: 'scripts', sessionId, payload: null });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('scripts'), WAIT);
};

const openAgentsOverScripts = async (ctx: Ctx): Promise<void> => {
  await openScriptsDrawer(ctx);
  useAppStore.getState().openDrawer({ kind: 'spawned', sessionId: ctx.sessionId, payload: null });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('spawned'), WAIT);
};

export const DRAWER_CHROME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'slot: the drawer it replaced waits in a back chip, the chip swaps, Esc walks back',
    covers: ['openDrawer', 'closeDrawer'],
    open: openAgentsOverScripts,
    lands: async () => {
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Back to Scripts' }));
      await settle();
      await waitFor(() => expect(openedKind()).toBe('scripts'), WAIT);
      expect(await screen.findByRole('button', { name: 'Back to Agents' })).toBeDefined();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBe('spawned'), WAIT);
      expect(screen.queryByRole('button', { name: /^Back to / })).toBeNull();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
  {
    name: 'slot: ⌘⇧W closes the top of the slot, then the drawer from the chip',
    covers: ['key:slot.close', 'closeDrawer'],
    open: openAgentsOverScripts,
    lands: async () => {
      pressShortcut({ id: 'slot.close' });
      await settle();
      await waitFor(() => expect(openedKind()).toBe('scripts'), WAIT);

      pressShortcut({ id: 'slot.close' });
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
];
