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

const tab = (name: string): HTMLElement => screen.getByRole('tab', { name });

export const QUEUE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Board: opens on the Queue and an answer in place waits for Undo',
    covers: ['navigate', 'queue:answer-undo'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async () => {
      await heading('Board');
      expect(tab('Queue').getAttribute('aria-selected')).toBe('true');
      const band = await needsYou();
      await click(await within(band).findByRole('button', { name: KEEP }, WAIT));

      expect(await screen.findByText('Answer queued', undefined, WAIT)).toBeDefined();
      await waitFor(() => expect(within(band).queryByText(QUESTION_TEXT)).toBeNull(), WAIT);
      expect(answers).not.toHaveBeenCalled();

      await act(async () => {
        await useAppStore.getState().undoLastOperation();
      });
      expect(await within(band).findByText(QUESTION_TEXT, undefined, WAIT)).toBeDefined();
      expect(answers).not.toHaveBeenCalled();
    },
  },
  {
    name: 'Board: the answer goes out once its window closes, to the question it named',
    covers: ['navigate', 'queue:answer-sends'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async ({ sessionId }) => {
      const band = await needsYou();
      await click(await within(band).findByRole('button', { name: KEEP }, WAIT));
      await act(async () => {
        useQueueSends.getState().flushAll();
      });
      await waitFor(() => expect(answers).toHaveBeenCalledTimes(1), WAIT);
      expect(answers).toHaveBeenCalledWith(
        sessionId,
        [{ id: QUESTION_ID, text: QUESTION_TEXT, answer: KEEP }],
        null,
      );
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
      await waitFor(() => expect(tab('Stages').getAttribute('aria-selected')).toBe('true'), WAIT);
      expect(document.querySelector('[data-select-id]')).not.toBeNull();
    },
  },
];
