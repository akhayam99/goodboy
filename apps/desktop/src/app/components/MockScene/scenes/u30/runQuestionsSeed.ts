import { brandId, type OpenQuestion, type OpenQuestionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { C09_RUN_ID, C09_SESSION_ID, C09_TESTER_ID } from '../u25/c09OrchestratedSeed';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

const WINDOW_QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'mock-u30-question-window' }),
  sessionId: C09_SESSION_ID,
  workflowRunId: C09_RUN_ID,
  createdByAgentId: C09_TESTER_ID,
  text: 'Should the export skip deliveries older than seven days?',
  suggestedAnswers: ['Skip them', 'Include them', 'Ask me on every run'],
  recommendedAnswer: 'Skip them',
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-16T15:05:00.000Z' }),
};

const ACCOUNTS_QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'mock-u30-question-accounts' }),
  sessionId: C09_SESSION_ID,
  workflowRunId: C09_RUN_ID,
  createdByAgentId: C09_TESTER_ID,
  text: 'Which Northwind accounts should the retries cover?',
  suggestedAnswers: ['Payments', 'Refunds', 'Payouts'],
  selectMode: 'many',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-16T15:06:00.000Z' }),
};

export const seedRunQuestions = (): void => {
  useAppStore.setState({
    sessionOpenQuestions: { [C09_SESSION_ID]: [WINDOW_QUESTION, ACCOUNTS_QUESTION] },
    sessionAnsweredQuestions: { [C09_SESSION_ID]: [] },
  });
};
