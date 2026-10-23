import { expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
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
import { SETTING_OVERVIEW_LAYOUT } from '../../../features/settings/settings';
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
    settings: { ...state.settings, [SETTING_OVERVIEW_LAYOUT]: 'new' },
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? { ...candidate, workflowRuns: [run] } : candidate,
    ),
    sessionWorkflows: { ...state.sessionWorkflows, [sessionId]: [workflow] },
    phaseTemplates: { ...state.phaseTemplates, [session.workspaceId]: [workflow] },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: [agent] },
  });
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
      const activity = screen.getByRole('region', { name: 'Activity' });
      expect(within(activity).queryAllByRole('button', { name: 'Answer' })).toHaveLength(0);
      expect(within(card).getAllByRole('button', { name: /^Open/ })).toHaveLength(1);

      await clickButton(/^Open: /);

      await lens('questions')(ctx);
    },
  },
];

const hasReadLayout = (): boolean =>
  vi
    .mocked(invoke)
    .mock.calls.some(
      ([command, args]) =>
        command === 'db_select' &&
        JSON.stringify(args ?? null).includes('"params":["overview.layout"]'),
    );

type EntryParams = {
  readonly label: RegExp;
  readonly query: string;
};

const openLayoutEntry = async ({ label, query }: EntryParams): Promise<void> => {
  vi.mocked(invoke).mockClear();
  await openPalette(label, query);
};

export const OVERVIEW_LAYOUT_ROWS: ReadonlyArray<Row> = [
  {
    name: 'palette: Use the new session overview starts the save of the setting',
    covers: ['palette:Use the new session overview'],
    open: () =>
      openLayoutEntry({ label: /^Use the new session overview/, query: 'session overview' }),
    lands: async () => {
      await waitFor(() => expect(hasReadLayout()).toBe(true));
    },
  },
  {
    name: 'palette: Use the classic session overview starts the save of the setting',
    covers: ['palette:Use the classic session overview'],
    open: () =>
      openLayoutEntry({ label: /^Use the classic session overview/, query: 'session overview' }),
    lands: async () => {
      await waitFor(() => expect(hasReadLayout()).toBe(true));
    },
  },
];
