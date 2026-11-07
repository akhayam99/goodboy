import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type PlanWithCount,
  type ReportArtifact,
  type SessionId,
} from '@goodboy/types';
import { aMountView } from '../../../../../features/session/testing/aMountView';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { C08_SESSION_ID } from '../u25/c08RunSeed';
import { seedRunsByBranch } from './runsListSeed';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-16T${time}.000Z` });

const DUP_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-duplicate-credit' });
const RETRY_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-retry-budget' });
const BACKFILL_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-backfill' });

const LEAD_ID = brandId<AgentId>({ value: 'mock-u36-c19-lead' });
const LEAD_ON_DUP_ID = brandId<AgentId>({ value: 'mock-u36-c19-lead-dup' });
const LEAD_ON_RETRY_ID = brandId<AgentId>({ value: 'mock-u36-c19-lead-retry' });
const SHARED_WRITER_ID = brandId<AgentId>({ value: 'mock-u36-c19-shared-writer' });
const EXPLAINER_ID = brandId<AgentId>({ value: 'mock-u36-c19-explainer' });

type AgentParams = {
  readonly id: AgentId;
  readonly name: string;
  readonly ordinal: number;
  readonly mountId?: MountId;
  readonly parentAgentId?: AgentId;
};

const agentOf = ({ id, name, ordinal, mountId, parentAgentId }: AgentParams): Agent => ({
  id,
  sessionId: C08_SESSION_ID,
  ordinal,
  name,
  kind: 'implementer',
  status: 'running',
  startedAt: at({ time: '15:02:00' }),
  ...(mountId === undefined ? {} : { mountId }),
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
});

const NEW_AGENTS: ReadonlyArray<Agent> = [
  agentOf({ id: LEAD_ID, name: 'Limit webhook retries', ordinal: 20 }),
  agentOf({
    id: LEAD_ON_DUP_ID,
    name: 'Cap credits per event',
    ordinal: 21,
    mountId: DUP_MOUNT,
    parentAgentId: LEAD_ID,
  }),
  agentOf({
    id: LEAD_ON_RETRY_ID,
    name: 'Budget retries per endpoint',
    ordinal: 22,
    mountId: RETRY_MOUNT,
    parentAgentId: LEAD_ID,
  }),
  agentOf({ id: SHARED_WRITER_ID, name: 'Explain the credit path', ordinal: 23 }),
  agentOf({ id: EXPLAINER_ID, name: 'Explain the retry flow', ordinal: 24 }),
];

type QuestionParams = {
  readonly id: string;
  readonly text: string;
  readonly askerId?: AgentId;
  readonly isBlocking?: boolean;
  readonly answer?: string;
  readonly minute: string;
  readonly sessionId?: SessionId;
};

const questionOf = ({
  id,
  text,
  askerId,
  isBlocking = false,
  answer,
  minute,
  sessionId = C08_SESSION_ID,
}: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: `mock-u36-c19-${id}` }),
  sessionId,
  ...(askerId === undefined ? {} : { createdByAgentId: askerId }),
  text,
  suggestedAnswers: ['Per endpoint', 'Per event'],
  isBlocking,
  userAnswer: answer ?? null,
  status: answer === undefined ? 'open' : 'answered',
  createdAt: at({ time: `14:${minute}:00` }),
  ...(answer === undefined ? {} : { answeredAt: at({ time: `15:${minute}:00` }) }),
});

const flakyAgentId = (): AgentId | undefined =>
  useAppStore
    .getState()
    .sessionPhaseRuns[C08_SESSION_ID]?.find((agent) => agent.mountId === BACKFILL_MOUNT)?.id;

const docsAgentId = (): AgentId | undefined =>
  useAppStore
    .getState()
    .sessionPhaseRuns[C08_SESSION_ID]?.find((agent) => agent.mountId === DUP_MOUNT)?.id;

const stoppedAgentId = (): AgentId | undefined =>
  useAppStore
    .getState()
    .sessionPhaseRuns[C08_SESSION_ID]?.find((agent) => agent.mountId === RETRY_MOUNT)?.id;

const withNewAgents = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [C08_SESSION_ID]: [...(state.sessionPhaseRuns[C08_SESSION_ID] ?? []), ...NEW_AGENTS],
    },
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionArtifacts: async () => undefined,
  });
};

type LensParams = {
  readonly lens: 'questions' | 'plans';
};

const setLens = ({ lens }: LensParams): void => {
  const state = useAppStore.getState();
  useAppStore.setState({ activeLens: { ...state.activeLens, [C08_SESSION_ID]: lens } });
};

export const seedWorkQuestions = (): void => {
  seedRunsByBranch();
  withNewAgents();
  const open: ReadonlyArray<OpenQuestion> = [
    questionOf({
      id: 'limit',
      text: 'Should the limit apply per endpoint or per event?',
      askerId: LEAD_ID,
      minute: '40',
    }),
    questionOf({
      id: 'queue',
      text: 'Which queue should delivery retries run on?',
      askerId: docsAgentId(),
      isBlocking: true,
      minute: '44',
    }),
    questionOf({
      id: 'pause',
      text: 'Can the backfill pause during the cutover?',
      askerId: flakyAgentId(),
      minute: '47',
    }),
  ];
  const answered: ReadonlyArray<OpenQuestion> = [
    questionOf({
      id: 'paging',
      text: 'How long may a delivery stay stuck before paging?',
      askerId: stoppedAgentId(),
      answer: 'Ten minutes',
      minute: '20',
    }),
    questionOf({
      id: 'table',
      text: 'Keep the old postings table for a month?',
      askerId: flakyAgentId(),
      answer: 'Yes',
      minute: '10',
    }),
    questionOf({
      id: 'guide',
      text: 'Should the retry guide cover Northwind?',
      answer: 'Yes',
      minute: '05',
    }),
  ];
  useAppStore.setState({
    sessionOpenQuestions: { [C08_SESSION_ID]: open },
    sessionAnsweredQuestions: { [C08_SESSION_ID]: answered },
  });
  setLens({ lens: 'questions' });
};

type PlanParams = {
  readonly id: string;
  readonly title: string;
  readonly agentId: AgentId | undefined;
  readonly status: PlanWithCount['status'];
  readonly minute: string;
  readonly sessionId?: SessionId;
};

const planOf = ({
  id,
  title,
  agentId,
  status,
  minute,
  sessionId = C08_SESSION_ID,
}: PlanParams): PlanWithCount | null =>
  agentId === undefined
    ? null
    : {
        id: brandId<ArtifactId>({ value: `mock-u36-c19-${id}` }),
        sessionId,
        agentId,
        title,
        bodyMd: '## Goal',
        status,
        createdAt: at({ time: `14:${minute}:00` }),
        updatedAt: at({ time: `14:${minute}:00` }),
        consumptionCount: status === 'consumed' ? 1 : 0,
      };

type ReportParams = {
  readonly id: string;
  readonly title: string;
  readonly agentId: AgentId | undefined;
  readonly minute: string;
  readonly sessionId?: SessionId;
};

const reportOf = ({
  id,
  title,
  agentId,
  minute,
  sessionId = C08_SESSION_ID,
}: ReportParams): ReportArtifact | null =>
  agentId === undefined
    ? null
    : {
        id: brandId<ArtifactId>({ value: `mock-u36-c19-${id}` }),
        sessionId,
        agentId,
        workflowRunId: null,
        kind: 'report',
        schemaVersion: 1,
        title,
        sourceFormat: 'markdown',
        sourceText: '## Notes',
        metadata: { reportType: 'session-summary' },
        status: 'active',
        revision: 1,
        sourceTurnId: null,
        createdAt: at({ time: `14:${minute}:00` }),
        updatedAt: at({ time: `14:${minute}:00` }),
        openedAt: at({ time: `14:${minute}:00` }),
      };

type PresentParams<Item> = {
  readonly items: ReadonlyArray<Item | null>;
};

const present = <Item>({ items }: PresentParams<Item>): ReadonlyArray<Item> =>
  items.flatMap((item) => (item === null ? [] : [item]));

export const seedWorkArtifacts = (): void => {
  seedRunsByBranch();
  withNewAgents();
  const plans = present({
    items: [
      planOf({
        id: 'plan-retry',
        title: 'Retry policy for notify-relay webhooks',
        agentId: stoppedAgentId(),
        status: 'active',
        minute: '30',
      }),
      planOf({
        id: 'plan-backfill',
        title: 'Backfill settlement dates',
        agentId: flakyAgentId(),
        status: 'active',
        minute: '20',
      }),
      planOf({
        id: 'plan-dedupe',
        title: 'Dedupe on the event id',
        agentId: docsAgentId(),
        status: 'consumed',
        minute: '10',
      }),
      planOf({
        id: 'plan-old',
        title: 'Drop the retry counter column',
        agentId: docsAgentId(),
        status: 'discarded',
        minute: '05',
      }),
    ],
  });
  const reports = present({
    items: [
      reportOf({
        id: 'report-credit',
        title: 'Retried webhooks no longer double credit',
        agentId: SHARED_WRITER_ID,
        minute: '50',
      }),
      reportOf({
        id: 'report-docs',
        title: 'Cap on credits per event',
        agentId: docsAgentId(),
        minute: '35',
      }),
      reportOf({
        id: 'report-flow',
        title: 'How retries work',
        agentId: EXPLAINER_ID,
        minute: '15',
      }),
    ],
  });
  useAppStore.setState({
    sessionPlans: { [C08_SESSION_ID]: plans },
    sessionArtifacts: { [C08_SESSION_ID]: reports },
  });
  setLens({ lens: 'plans' });
};

type BranchLinksParams = {
  readonly sessionId: SessionId;
};

export const seedBranchLinks = ({ sessionId }: BranchLinksParams): void => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[sessionId]?.[0];
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const asker = agents[0];
  if (mount === undefined || asker === undefined) {
    return;
  }
  const { mountId } = mount;
  const on = { ...asker, mountId };

  useAppStore.setState({
    sessionMounts: {
      ...state.sessionMounts,
      [sessionId]: [
        {
          ...aMountView({
            key: 'branch-links',
            sessionId,
            projectId: mount.projectId,
            projectName: 'payments-api',
            branch: mount.branch,
          }),
          id: mountId,
          worktreePath: mount.worktreePath,
        },
      ],
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: agents.map((agent) => ({ ...agent, mountId })),
    },
    sessionOpenQuestions: {
      [sessionId]: [
        questionOf({
          id: 'branch-limit',
          text: 'Should the limit apply per endpoint or per event?',
          askerId: on.id,
          minute: '40',
          sessionId,
        }),
        questionOf({
          id: 'branch-queue',
          text: 'Which queue should delivery retries run on?',
          askerId: on.id,
          minute: '44',
          sessionId,
        }),
      ],
    },
    sessionAnsweredQuestions: { [sessionId]: [] },
    sessionPlans: {
      [sessionId]: present({
        items: [
          planOf({
            id: 'branch-plan',
            title: 'Retry policy for notify-relay webhooks',
            agentId: on.id,
            status: 'active',
            minute: '30',
            sessionId,
          }),
        ],
      }),
    },
    sessionArtifacts: {
      [sessionId]: present({
        items: [
          reportOf({
            id: 'branch-report-a',
            title: 'Retried webhooks no longer double credit',
            agentId: on.id,
            minute: '50',
            sessionId,
          }),
          reportOf({
            id: 'branch-report-b',
            title: 'How retries work',
            agentId: on.id,
            minute: '15',
            sessionId,
          }),
        ],
      }),
    },
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionArtifacts: async () => undefined,
  });
};
