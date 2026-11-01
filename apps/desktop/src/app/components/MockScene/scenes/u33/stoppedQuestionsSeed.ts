import {
  brandId,
  type OpenQuestion,
  type OpenQuestionId,
  type WorkflowOrchestrationStop,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  BLOCKED_MOUNT_AGENT_ID,
  BLOCKED_MOUNT_RUN_ID,
  BLOCKED_MOUNT_SESSION_ID,
  seedBlockedMountStep,
} from '../u30/blockedMountStepSeed';

const clock = sceneClock({ anchor: '2026-10-31T15:12:00.000Z' });

export const STOPPED_FIRST_QUESTION_ID = 'mock-u33-sq-window';
export const STOPPED_SECOND_QUESTION_ID = 'mock-u33-sq-size';

export const BUDGET_STOP: WorkflowOrchestrationStop = {
  kind: 'budget',
  message: 'Paused at the $5 limit for this session.',
};

type QuestionParams = {
  readonly id: string;
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
  readonly at: string;
};

const questionOf = ({ id, text, suggestedAnswers, at }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: BLOCKED_MOUNT_SESSION_ID,
  workflowRunId: BLOCKED_MOUNT_RUN_ID,
  createdByAgentId: BLOCKED_MOUNT_AGENT_ID,
  text,
  suggestedAnswers,
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at }),
});

const STOPPED_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  questionOf({
    id: STOPPED_FIRST_QUESTION_ID,
    text: 'Should refunds older than 90 days be batched too?',
    suggestedAnswers: ['Batch them', 'Leave them out'],
    at: '2026-10-31T15:10:00.000Z',
  }),
  questionOf({
    id: STOPPED_SECOND_QUESTION_ID,
    text: 'Which batch size should refunds use?',
    suggestedAnswers: ['250 rows', '500 rows', '1,000 rows'],
    at: '2026-10-31T15:11:00.000Z',
  }),
];

type Params = {
  readonly stop: WorkflowOrchestrationStop;
};

export const seedStoppedQuestions = ({ stop }: Params): void => {
  seedBlockedMountStep();
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) => ({
      ...session,
      workflowRuns: session.workflowRuns.map((run) => ({ ...run, orchestrationStop: stop })),
    })),
    sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: STOPPED_QUESTIONS },
    sessionAnsweredQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] },
  }));
};
