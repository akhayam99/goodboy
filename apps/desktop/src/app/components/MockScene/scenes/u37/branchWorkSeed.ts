import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type PlanWithCount,
  type ReportArtifact,
  type SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { seedBranchLinks } from '../u36/workByBranchSeed';

const clock = sceneClock({ anchor: '2026-11-07T15:12:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-11-07T${time}.000Z` });

type QuestionParams = {
  readonly sessionId: SessionId;
  readonly askerId: AgentId;
  readonly id: string;
  readonly text: string;
  readonly minute: string;
  readonly answer?: string;
};

const questionOf = ({
  sessionId,
  askerId,
  id,
  text,
  minute,
  answer,
}: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: `mock-u37-work-${id}` }),
  sessionId,
  createdByAgentId: askerId,
  text,
  suggestedAnswers: ['Per endpoint', 'Per event'],
  isBlocking: answer === undefined,
  userAnswer: answer ?? null,
  status: answer === undefined ? 'open' : 'answered',
  createdAt: at({ time: `14:${minute}:00` }),
  ...(answer === undefined ? {} : { answeredAt: at({ time: `15:${minute}:00` }) }),
});

type ArtifactParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const planOf = ({ sessionId, agentId }: ArtifactParams): PlanWithCount => ({
  id: brandId<ArtifactId>({ value: 'mock-u37-work-plan' }),
  sessionId,
  agentId,
  title: 'Idempotent credit posting',
  bodyMd: '## Goal\nPost a credit once per webhook event.',
  status: 'consumed',
  createdAt: at({ time: '14:10:00' }),
  updatedAt: at({ time: '14:10:00' }),
  consumptionCount: 1,
});

const reportOf = ({ sessionId, agentId }: ArtifactParams): ReportArtifact => ({
  id: brandId<ArtifactId>({ value: 'mock-u37-work-report' }),
  sessionId,
  agentId,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Duplicate credit audit',
  sourceFormat: 'markdown',
  sourceText: '## Findings\nFourteen webhooks checked in payments-api.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: at({ time: '14:30:00' }),
  updatedAt: at({ time: '14:30:00' }),
  openedAt: at({ time: '14:30:00' }),
});

type AgentParams = {
  readonly base: Agent;
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly isDone: boolean;
};

const implementerOf = ({ base, id, name, ordinal, isDone }: AgentParams): Agent => ({
  ...base,
  id: brandId<AgentId>({ value: `mock-u37-work-${id}` }),
  name,
  kind: 'implementer',
  sourceKind: undefined,
  sourceCommentUrl: undefined,
  status: isDone ? 'completed' : 'running',
  ordinal,
  startedAt: at({ time: isDone ? '12:00:00' : '14:32:00' }),
});

type Params = {
  readonly sessionId: SessionId;
};

export const seedBranchWork = ({ sessionId }: Params): void => {
  seedBranchLinks({ sessionId });
  const state = useAppStore.getState();
  const base = state.sessionPhaseRuns[sessionId]?.[0];
  if (base === undefined) {
    return;
  }
  const asker = implementerOf({
    base,
    id: 'credit',
    name: 'Fix duplicate credit',
    ordinal: 2,
    isDone: false,
  });
  const guide = implementerOf({
    base,
    id: 'guide',
    name: 'Write the retry guide',
    ordinal: 3,
    isDone: true,
  });
  const askerId = asker.id;
  useAppStore.setState({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: [base, asker, guide] },
    sessionOpenQuestions: {
      [sessionId]: [
        questionOf({
          sessionId,
          askerId,
          id: 'limit',
          text: 'Should the limit apply per endpoint or per event?',
          minute: '40',
        }),
      ],
    },
    sessionAnsweredQuestions: {
      [sessionId]: [
        questionOf({
          sessionId,
          askerId,
          id: 'queue',
          text: 'Which queue should delivery retries run on?',
          minute: '20',
          answer: 'The existing webhook queue',
        }),
        questionOf({
          sessionId,
          askerId,
          id: 'backfill',
          text: 'Can the backfill pause during the cutover?',
          minute: '05',
          answer: 'Yes, pause it',
        }),
      ],
    },
    sessionPlans: { [sessionId]: [planOf({ sessionId, agentId: askerId })] },
    sessionArtifacts: { [sessionId]: [reportOf({ sessionId, agentId: askerId })] },
    loadSessionArtifacts: async () => undefined,
    loadSessionPlans: async () => undefined,
    branchTab: { ...state.branchTab, [sessionId]: 'work' },
  });
};
