import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { type Row, WAIT, click, lens, openPalette, settle, useAppStore } from './harness';

const STARTED_AT = brandId<IsoDateTime>({ value: '2026-10-20T09:00:00.000Z' });

type SeedParams = {
  readonly sessionId: SessionId;
};

const archiveSession = ({ sessionId }: SeedParams): void => {
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? { ...candidate, archivedAt: STARTED_AT } : candidate,
    ),
  }));
};

export const OVERVIEW_ROWS: ReadonlyArray<Row> = [
  {
    name: 'overview: a waiting question is answered from its row on the board only',
    covers: ['overview:needs-you-only'],
    open: async (ctx) => {
      useAppStore.setState({
        sessionOpenQuestions: {
          [ctx.sessionId]: [openQuestionFor({ sessionId: ctx.sessionId as SessionId })],
        },
      });
      await settle();
    },
    lands: async (ctx) => {
      const board = await screen.findByRole('region', { name: 'Branches' }, WAIT);
      expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
      const answers = screen.getAllByRole('button', { name: 'Answer' });
      for (const answer of answers) {
        expect(board.contains(answer)).toBe(true);
      }
      const [answer] = within(board).getAllByRole('button', { name: 'Answer' });
      if (answer === undefined) {
        throw new Error('the question row has no Answer button');
      }
      await click(answer);

      await lens('questions')(ctx);
    },
  },
  {
    name: 'palette: Open the full log opens the log drawer beside the Overview',
    covers: ['palette:Open the full log'],
    open: () => openPalette(/^Open the full log/, 'full log'),
    lands: async () => {
      expect(await screen.findByRole('region', { name: 'Log entries' }, WAIT)).toBeDefined();
      expect(document.querySelector('[data-page="overview"]')).not.toBeNull();
    },
  },
  {
    name: 'overview: an archived session keeps the board with Restore in the header',
    covers: ['overview:archived-done-only'],
    open: async ({ sessionId }) => {
      archiveSession({ sessionId });
      await settle();
    },
    lands: async () => {
      expect(await screen.findByRole('button', { name: 'Restore' }, WAIT)).toBeDefined();
      expect(screen.queryByRole('region', { name: 'Done' })).toBeNull();
      expect(document.querySelector('[data-overview-card]')).toBeNull();
    },
  },
];
