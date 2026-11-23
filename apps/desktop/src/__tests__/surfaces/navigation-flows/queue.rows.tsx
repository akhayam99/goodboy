import { expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { useQueueSends } from '../../../features/board/queue/QueueBoard/useQueueSends';
import {
  type Ctx,
  type Row,
  WAIT,
  click,
  heading,
  pressBoardKey,
  showStages,
  useAppStore,
} from './harness';

const QUESTION_TEXT = 'Keep the webhook retry window at five minutes?';
const KEEP = 'Keep five minutes';

const CREATED_AT: IsoDateTime = JSON.parse(JSON.stringify('2026-10-05T09:00:00.000Z'));
const QUESTION_ID: OpenQuestionId = JSON.parse(JSON.stringify('queue-question-retry'));

const answers = vi.fn(async () => undefined);

const seedQuestion = ({ sessionId }: Ctx): void => {
  const question: OpenQuestion = {
    id: QUESTION_ID,
    sessionId,
    text: QUESTION_TEXT,
    suggestedAnswers: [KEEP, 'Drop to one minute'],
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: CREATED_AT,
  };
  answers.mockClear();
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {} });
  useAppStore.setState((state) => ({
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId]: [question] },
    answerOpenQuestions: answers,
  }));
};

const needsYou = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Needs you' }, WAIT);

type TabParams = {
  readonly name: string;
};

const tab = ({ name }: TabParams): HTMLElement => screen.getByRole('tab', { name });

export const QUEUE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Board: opens on the Queue and one click on a Needs you row opens its session',
    covers: ['navigate', 'queue:row-opens'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async ({ sessionId }) => {
      await heading('Board');
      expect(tab({ name: 'Queue' }).getAttribute('aria-selected')).toBe('true');
      const band = await needsYou();
      expect(within(band).queryByRole('button', { name: 'Open in session' })).toBeNull();
      await click(await within(band).findByRole('button', { name: QUESTION_TEXT }, WAIT));
      await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(sessionId), WAIT);
      expect(answers).not.toHaveBeenCalled();
    },
  },
  {
    name: 'Board: Not now on a Needs you row puts it off, and Undo brings it back',
    covers: ['navigate', 'queue:row-not-now'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async () => {
      const band = await needsYou();
      await click(
        await within(band).findByRole('button', { name: `Not now: ${QUESTION_TEXT}` }, WAIT),
      );
      await waitFor(() => expect(within(band).queryByText(QUESTION_TEXT)).toBeNull(), WAIT);
      await act(async () => {
        await useAppStore.getState().undoLastOperation();
      });
      await within(band).findByText(QUESTION_TEXT, undefined, WAIT);
    },
  },
  {
    name: 'Board: F6 passes the keys from band to band and S puts a Move off with Undo',
    covers: ['navigate', 'queue:band-keys'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async () => {
      const band = await needsYou();
      await within(band).findByText(QUESTION_TEXT, undefined, WAIT);
      const queue = document.querySelector<HTMLElement>('[data-queue]');
      if (queue === null) {
        throw new Error('the Queue is not on screen');
      }
      for (const next of ['running', 'ready', 'needs-you']) {
        fireEvent.keyDown(queue, { key: 'F6' });
        await waitFor(() => expect(queue.getAttribute('data-active-band')).toBe(next));
      }
      fireEvent.keyDown(queue, { key: 's' });
      expect(await screen.findByText('Dismissed', undefined, WAIT)).toBeDefined();
      await waitFor(() => expect(within(band).queryByText(QUESTION_TEXT)).toBeNull(), WAIT);
      await click(within(band).getByRole('button', { name: 'Show 1 hidden' }));
      expect(await within(band).findByText(QUESTION_TEXT, undefined, WAIT)).toBeDefined();
    },
  },
  {
    name: 'Board: Stages is the board of today and Back finds the layout it had',
    covers: ['navigate', 'queue:layout-back'],
    open: async () => {
      await pressBoardKey();
      await showStages();
      const card = await waitFor(() => {
        const found = document.querySelector<HTMLElement>('[data-select-id] button');
        expect(found).not.toBeNull();
        return found;
      }, WAIT);
      if (card === null) {
        throw new Error('the Stages layout has no card');
      }
      await click(card);
      await act(async () => {
        useAppStore.getState().back();
      });
    },
    lands: async () => {
      await heading('Board');
      await waitFor(
        () => expect(tab({ name: 'Stages' }).getAttribute('aria-selected')).toBe('true'),
        WAIT,
      );
      expect(document.querySelector('[data-select-id]')).not.toBeNull();
    },
  },
];
