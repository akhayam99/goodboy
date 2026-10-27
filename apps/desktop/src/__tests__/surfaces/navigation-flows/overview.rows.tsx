import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import {
  type Row,
  WAIT,
  click,
  clickButton,
  lens,
  openPalette,
  settle,
  useAppStore,
} from './harness';

const RUN_TITLE = 'Center the member pages';
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'overview-orchestrated-workflow' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'overview-orchestrated-run' });
const STEP_ID = brandId<StepId>({ value: 'overview-orchestrated-step' });
const STARTED_AT = brandId<IsoDateTime>({ value: '2026-10-20T09:00:00.000Z' });

type SeedParams = {
  readonly sessionId: SessionId;
};

const seedOrchestratedRun = ({ sessionId }: SeedParams): void => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error('the Overview seed lost its session');
  }
  const workflow: Workflow = {
    id: WORKFLOW_ID,
    workspaceId: session.workspaceId,
    name: 'Orchestrated',
    description: '',
    origin: 'orchestrated',
    steps: [
      {
        id: STEP_ID,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        name: 'Center the pages',
        promptPrefix: '',
      },
    ],
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
  const run: WorkflowRun = {
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: 'dynamic',
    title: RUN_TITLE,
    createdAt: STARTED_AT,
  };
  const agent: Agent = {
    id: brandId<AgentId>({ value: 'overview-orchestrated-agent' }),
    sessionId,
    ordinal: 0,
    name: 'Center the pages',
    kind: 'implementer',
    status: 'running',
    workflowRunId: RUN_ID,
    stepId: STEP_ID,
    startedAt: STARTED_AT,
  };
  useAppStore.setState({
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? { ...candidate, workflowRuns: [run] } : candidate,
    ),
    sessionWorkflows: { ...state.sessionWorkflows, [sessionId]: [workflow] },
    phaseTemplates: { ...state.phaseTemplates, [session.workspaceId]: [workflow] },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: [agent] },
  });
};

const RUNNING_AGENT_ID = brandId<AgentId>({ value: 'overview-running-agent' });
const RUNNING_AGENT_NAME = 'Add the limit check to payout creation';

const seedRunningAgent = ({ sessionId }: SeedParams): void => {
  const state = useAppStore.getState();
  const agent: Agent = {
    id: RUNNING_AGENT_ID,
    sessionId,
    ordinal: 90,
    name: RUNNING_AGENT_NAME,
    kind: 'implementer',
    status: 'running',
    startedAt: STARTED_AT,
  };
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), agent],
    },
    agentTurnState: {
      ...state.agentTurnState,
      [RUNNING_AGENT_ID]: { kind: 'running', runId: 'overview-running-run', startedAt: STARTED_AT },
    },
  });
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
    name: 'overview: an orchestrated run opens its own page and Back returns to Overview',
    covers: ['navigate', 'overview:orchestrated-run'],
    open: async ({ sessionId }) => {
      seedOrchestratedRun({ sessionId });
      await settle();
      await clickButton(`Open ${RUN_TITLE}`);
    },
    lands: async () => {
      expect(await screen.findByRole('article', { name: RUN_TITLE }, WAIT)).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Runs' })).toBeNull();
      const back = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
      ).find((candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('Back'));
      if (back === undefined) {
        throw new Error('the navigation cluster has no Back button');
      }
      await click(back);
      await waitFor(
        () => expect(document.querySelector('[data-page="overview"]')).not.toBeNull(),
        WAIT,
      );
    },
  },
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
      expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
      for (const answer of screen.queryAllByRole('button', { name: 'Answer' })) {
        expect(card.contains(answer)).toBe(true);
      }
      const [title] = within(card).getAllByRole('link');
      if (title === undefined) {
        throw new Error('the question row has no title that opens it');
      }
      await click(title);

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
    name: 'overview: an agent in Running opens its chat and Back returns to Overview',
    covers: ['navigate', 'overview:running-agent'],
    open: async ({ sessionId }) => {
      seedRunningAgent({ sessionId });
      await settle();
      await clickButton(`Open ${RUNNING_AGENT_NAME}`);
    },
    lands: async () => {
      expect(
        await screen.findByPlaceholderText(/^What should .* build\?/, undefined, WAIT),
      ).toBeDefined();
      const back = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
      ).find((candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('Back'));
      if (back === undefined) {
        throw new Error('the navigation cluster has no Back button');
      }
      await click(back);
      await waitFor(
        () => expect(document.querySelector('[data-page="overview"]')).not.toBeNull(),
        WAIT,
      );
    },
  },
  {
    name: 'overview: an archived session keeps the Done card with its Full log',
    covers: ['overview:archived-done-only'],
    open: async ({ sessionId }) => {
      archiveSession({ sessionId });
      await settle();
    },
    lands: async () => {
      await screen.findByRole('region', { name: 'Done' }, WAIT);
      const ids = Array.from(document.querySelectorAll('[data-overview-card]')).map((card) =>
        card.getAttribute('data-overview-card'),
      );
      expect(ids).toEqual(['done']);
      expect(screen.getByRole('button', { name: 'Full log' })).toBeDefined();
    },
  },
];
