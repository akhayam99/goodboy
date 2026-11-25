import { expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import {
  type Ctx,
  type Row,
  WAIT,
  click,
  clickBackArrow,
  clickButton,
  heading,
  pressBoardKey,
  settle,
  useAppStore,
} from './harness';

const QUESTION_TEXT = 'Keep the webhook retry window at five minutes?';

const CREATED_AT: IsoDateTime = JSON.parse(JSON.stringify('2026-10-05T09:00:00.000Z'));
const QUESTION_ID: OpenQuestionId = JSON.parse(JSON.stringify('needs-you-question-retry'));

const answers = vi.fn(async () => undefined);

const seedQuestion = ({ sessionId }: Ctx): void => {
  const question: OpenQuestion = {
    id: QUESTION_ID,
    sessionId,
    text: QUESTION_TEXT,
    suggestedAnswers: ['Keep five minutes', 'Drop to one minute'],
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: CREATED_AT,
  };
  answers.mockClear();
  useAppStore.setState((state) => ({
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId]: [question] },
    answerOpenQuestions: answers,
  }));
};

const markBoardEntryAsQueue = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  const stack = workspaceId === null ? undefined : state.navigation[workspaceId];
  const entry = stack?.entries[stack.index];
  if (workspaceId === null || stack === undefined || entry === undefined) {
    throw new Error('the seed has no board entry');
  }
  const retired = {
    ...entry,
    focus: {
      ...entry.focus,
      returnRows: { 'board.layout': 'queue', 'board.move': 'retired:open-question' },
    },
  };
  useAppStore.setState({
    navigation: {
      ...state.navigation,
      [workspaceId]: {
        ...stack,
        entries: stack.entries.map((candidate, index) =>
          index === stack.index ? retired : candidate,
        ),
      },
    },
  });
};

const needsYou = (): Promise<HTMLElement> => screen.findByRole('group', { name: 'running' }, WAIT);

const opensTheQuestion = (name: string): boolean =>
  name.startsWith('Open ') && name.endsWith(QUESTION_TEXT);

export const NEEDS_YOU_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Board: one click on a yellow card in Running opens its session at the question',
    covers: ['navigate', 'needs-you:card-opens'],
    open: async (ctx) => {
      seedQuestion(ctx);
      await pressBoardKey();
    },
    lands: async ({ sessionId }) => {
      await heading('Board');
      const strip = await needsYou();
      expect(within(strip).queryByRole('button', { name: 'Keep five minutes' })).toBeNull();
      expect(within(strip).queryByRole('textbox')).toBeNull();
      await click(await within(strip).findByRole('button', { name: opensTheQuestion }, WAIT));
      await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(sessionId), WAIT);
      expect(answers).not.toHaveBeenCalled();
    },
  },
  {
    name: 'Board: a history entry saved on the retired Queue opens the stages',
    covers: ['navigate', 'back', 'forward', 'needs-you:retired-queue-entry'],
    open: async () => {
      await pressBoardKey();
      markBoardEntryAsQueue();
      await clickBackArrow();
      await clickButton(/^Forward/);
      await settle();
    },
    lands: async () => {
      await heading('Board');
      expect(await screen.findByRole('group', { name: 'building' }, WAIT)).toBeDefined();
      expect(screen.queryByRole('tab', { name: 'Queue' })).toBeNull();
      expect(screen.queryByRole('group', { name: 'needs you' })).toBeNull();
    },
  },
];
