import {
  brandId,
  type Agent,
  type OpenQuestion,
  type OpenQuestionId,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  BLOCKED_MOUNT_AGENT_ID,
  BLOCKED_MOUNT_B,
  BLOCKED_MOUNT_SESSION_ID,
  seedBlockedMountStep,
} from '../u30/blockedMountStepSeed';

const clock = sceneClock({ anchor: '2026-10-29T15:12:00.000Z' });

const STEP_RUN = brandId<ProviderRunId>({ value: 'mock-u32-rq-provider-refunds' });

type QuestionParams = {
  readonly id: string;
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
  readonly minute: string;
};

const questionOf = ({ id, text, suggestedAnswers, minute }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: BLOCKED_MOUNT_SESSION_ID,
  createdByAgentId: BLOCKED_MOUNT_AGENT_ID,
  text,
  suggestedAnswers,
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at: `2026-10-29T15:${minute}.000Z` }),
});

export const REFUNDS_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  questionOf({
    id: 'mock-u32-rq-window',
    text: 'Should refunds older than 90 days be batched too?',
    suggestedAnswers: ['Batch them', 'Leave them out'],
    minute: '10:00',
  }),
  questionOf({
    id: 'mock-u32-rq-size',
    text: 'Which batch size should refunds use?',
    suggestedAnswers: ['250 rows', '500 rows', '1,000 rows'],
    minute: '10:01',
  }),
  questionOf({
    id: 'mock-u32-rq-csv',
    text: 'May the refunds CSV gain a column for the batch number?',
    suggestedAnswers: ['Yes', 'No'],
    minute: '10:02',
  }),
];

const REFUNDS_TURN: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: STEP_RUN,
    text: 'Cover refunds with the same batching.',
    at: clock.iso({ at: '2026-10-29T15:09:30.000Z' }),
  },
  {
    kind: 'assistant_text',
    runId: STEP_RUN,
    delta: 'Should refunds older than 90 days be batched too?',
    at: clock.iso({ at: '2026-10-29T15:10:00.000Z' }),
  },
  { kind: 'done', runId: STEP_RUN, at: clock.iso({ at: '2026-10-29T15:10:00.000Z' }) },
];

export const seedRunQuestions = (): void => {
  seedBlockedMountStep();
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [BLOCKED_MOUNT_SESSION_ID]: (state.sessionPhaseRuns[BLOCKED_MOUNT_SESSION_ID] ?? []).map(
        (agent: Agent) =>
          agent.id === BLOCKED_MOUNT_AGENT_ID ? { ...agent, mountId: BLOCKED_MOUNT_B } : agent,
      ),
    },
    transcripts: { ...state.transcripts, [BLOCKED_MOUNT_AGENT_ID]: REFUNDS_TURN },
    sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: REFUNDS_QUESTIONS },
    sessionAnsweredQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] },
  }));
};
