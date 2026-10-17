import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { type Row, WAIT, clickButton, lens, settle, useAppStore } from './harness';

export const OVERVIEW_ROWS: ReadonlyArray<Row> = [
  {
    name: 'overview: a waiting question is answered from the Needs you card only',
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
      const card = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
      const activity = screen.getByRole('region', { name: 'Activity' });
      expect(within(activity).queryAllByRole('button', { name: 'Answer' })).toHaveLength(0);
      expect(within(card).getAllByRole('button', { name: /^Open/ })).toHaveLength(1);

      await clickButton(/^Open: /);

      await lens('questions')(ctx);
    },
  },
];
