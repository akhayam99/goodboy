import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import {
  type Ctx,
  type Row,
  WAIT,
  click,
  clickButton,
  heading,
  settle,
  openPalette,
  useAppStore,
  pressBoardKey,
} from './harness';

const ARCHIVED_GOAL = 'Update the refund macros for support';

const ARCHIVED_AT: IsoDateTime = JSON.parse(JSON.stringify('2026-10-02T09:00:00.000Z'));

const lane = async (name: string): Promise<HTMLElement> =>
  screen.findByRole('group', { name }, WAIT);

const ARCHIVED_ID: SessionId = JSON.parse(JSON.stringify('board-lanes-archived-session'));

const shelveOneSession = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const live = state.sessions.find((session) => session.id === sessionId);
  if (live === undefined) {
    throw new Error('the board seed has no session to copy');
  }
  useAppStore.setState({
    archivedSessions: {
      ...state.archivedSessions,
      [live.workspaceId]: [
        {
          ...live,
          id: ARCHIVED_ID,
          goal: ARCHIVED_GOAL,
          archivedAt: ARCHIVED_AT,
          state: { kind: 'ended', endedAt: ARCHIVED_AT },
        },
      ],
    },
  });
};

export const BOARD_LANES_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Board: Archived folds to its count, Show all opens it and Restore sends its first card to its stage',
    covers: ['navigate', 'board-lanes:archived-restore'],
    open: async (ctx) => {
      shelveOneSession(ctx);
      await pressBoardKey();
      await settle();
    },
    lands: async () => {
      await heading('Board');
      const archived = await lane('archived');
      expect(within(archived).queryByRole('button', { name: ARCHIVED_GOAL })).toBeNull();
      await click(within(archived).getByRole('button', { name: 'Show all' }));
      within(archived).getByRole('button', { name: ARCHIVED_GOAL });
      expect(await lane('done')).toBeDefined();

      await click(within(archived).getByRole('button', { name: /^Restore/ }));

      const building = await lane('building');
      expect(
        await within(building).findByRole('button', { name: ARCHIVED_GOAL }, WAIT),
      ).toBeDefined();
      expect(within(await lane('archived')).getByText('Nothing archived')).toBeDefined();
    },
  },
  {
    name: 'Board: the Board door works from the New session draft',
    covers: ['navigate', 'board-lanes:draft-door'],
    open: async () => {
      await openPalette(/^New session/);
      await heading('New session');
      await pressBoardKey();
      await settle();
    },
    lands: async () => {
      await heading('Board');
      expect(await lane('archived')).toBeDefined();
      expect(await lane('done')).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'New session' })).toBeNull();
      expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();
    },
  },
];
