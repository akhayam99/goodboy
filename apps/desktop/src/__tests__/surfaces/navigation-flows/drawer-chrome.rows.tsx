import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const openTranscriptDrawer = async ({ sessionId }: Ctx): Promise<void> => {
  const agent = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
  );
  if (agent === undefined) {
    throw new Error('the seeded session has no standalone agent');
  }
  useAppStore
    .getState()
    .openDrawer({ kind: 'transcript', sessionId, payload: { agentId: agent.id } });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('transcript'), WAIT);
};

const openReportOverTranscript = async (ctx: Ctx): Promise<void> => {
  await openTranscriptDrawer(ctx);
  useAppStore
    .getState()
    .openDrawer({ kind: 'new', sessionId: ctx.sessionId, payload: { form: 'report' } });
  await settle();
  await waitFor(() => expect(openedKind()).toBe('new'), WAIT);
};

export const DRAWER_CHROME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'slot: the drawer it replaced waits in a back chip, the chip swaps, Esc walks back',
    covers: ['openDrawer', 'closeDrawer'],
    open: openReportOverTranscript,
    lands: async () => {
      await userEvent
        .setup()
        .click(await screen.findByRole('button', { name: 'Back to Transcript' }));
      await settle();
      await waitFor(() => expect(openedKind()).toBe('transcript'), WAIT);
      expect(await screen.findByRole('button', { name: 'Back to New · Report' })).toBeDefined();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBe('new'), WAIT);
      expect(screen.queryByRole('button', { name: /^Back to / })).toBeNull();

      await pressEscape();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
  {
    name: 'slot: ⌘⇧W closes the top of the slot, then the drawer from the chip',
    covers: ['key:slot.close', 'closeDrawer'],
    open: openReportOverTranscript,
    lands: async () => {
      pressShortcut({ id: 'slot.close' });
      await settle();
      await waitFor(() => expect(openedKind()).toBe('transcript'), WAIT);

      pressShortcut({ id: 'slot.close' });
      await settle();
      await waitFor(() => expect(openedKind()).toBeNull(), WAIT);
    },
  },
  {
    name: 'ask draft: type, change tab, the pane stays; close it, ⌘L brings the draft back',
    covers: ['key:ask.open', 'openAsk', 'closeAsk'],
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
      openLens({ sessionId: ctx.sessionId, lens: 'workflows' });
      await settle();
      expect(openedKind()).toBe('ask');
      expect((await composer()).value).toBe(DRAFT);

      await userEvent.setup().click(
        within(screen.getByRole('region', { name: 'Ask' })).getByRole('button', {
          name: 'Close',
        }),
      );
      await settle();
      expect(screen.queryByRole('textbox', { name: 'Ask about this session' })).toBeNull();

      pressShortcut({ id: 'ask.open' });
      await settle();
      const reopened = await composer();
      expect(reopened.value).toBe(DRAFT);
      await waitFor(() => expect(document.activeElement).toBe(reopened), WAIT);
    },
  },
];
