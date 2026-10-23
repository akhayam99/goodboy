// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting } from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { changeRunRoute } from './changeRunRoute';
import { runRoutesKey, writeRunRoute } from './runRoutesSetting';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Billing pages' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-billing' });
const RUN_WORKFLOW = brandId<WorkflowId>({ value: 'wf-run-billing' });
const LAYOUT_ID = brandId<WorkflowId>({ value: 'workflow-layout' });
const AUDIT_ID = brandId<WorkflowId>({ value: 'workflow-audit' });
const ROOT = brandId<AgentId>({ value: 'agent-ledger-core' });
const NEW_AGENT = brandId<AgentId>({ value: 'agent-payments-api' });
const ASK = 'Fix the billing table on every page';

const presetOf = (id: WorkflowId, name: string): Workflow => ({
  id,
  workspaceId: WORKSPACE.id,
  name,
  description: '',
  steps: [
    {
      id: brandId<StepId>({ value: `${id}-find` }),
      workflowId: id,
      ordinal: 0,
      name: 'Find',
      role: 'scout',
      promptPrefix: '',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: NOW,
  updatedAt: NOW,
});

const RUN_TEMPLATE: Workflow = {
  id: RUN_WORKFLOW,
  workspaceId: WORKSPACE.id,
  name: 'Plan from Fix a layout',
  description: '',
  goal: ASK,
  processText: 'Start from the preset Fix a layout.',
  steps: [],
  isPreset: false,
  origin: 'orchestrated',
  createdAt: NOW,
  updatedAt: NOW,
};

const PLAN_ROUTE: RunRoute = {
  shape: 'plan',
  row: 2,
  presetName: 'Fix a layout',
  closeness: 'adapt',
  role: null,
  choice: 'Workflow · Preset Fix a layout · Adapt as it goes',
  why: 'Your ask matches the preset',
  ask: ASK,
};

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

const planTarget = { kind: 'plan' as const, sessionId: SESSION.id, runId: RUN_ID };

type SeedParams = {
  readonly hasWork: boolean;
};

const seedPlanRun = ({ hasWork }: SeedParams) => {
  const run = aWorkflowRun({
    id: RUN_ID,
    workflowId: RUN_WORKFLOW,
    executionMode: 'dynamic',
    goal: ASK,
    orchestratorSummary: JSON.stringify({ done: ['Found the billing table'], left: [] }),
    rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, route: PLAN_ROUTE },
  });
  useAppStore.setState({
    sessions: [{ ...SESSION, workflowRuns: [run] }],
    phaseTemplates: {
      [WORKSPACE.id]: [
        presetOf(LAYOUT_ID, 'Fix a layout'),
        presetOf(AUDIT_ID, 'Audit pages'),
        RUN_TEMPLATE,
      ],
    },
    sessionPhaseRuns: {
      [SESSION.id]: hasWork
        ? [
            anAgent({
              sessionId: SESSION.id,
              workflowRunId: RUN_ID,
              name: 'Scout the billing table',
              status: 'completed',
              outputSummary: 'The table scrolls sideways at 390px',
            }),
          ]
        : [],
    },
  });
};

const runOf = () =>
  useAppStore
    .getState()
    .sessions.find((session) => session.id === SESSION.id)
    ?.workflowRuns.find((run) => run.id === RUN_ID);

const mockEngines = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => NEW_AGENT);
  const attachWorkflowToSession = vi.fn<StoryState['attachWorkflowToSession']>(
    async () => undefined,
  );
  const savePhaseTemplate = vi.fn<StoryState['savePhaseTemplate']>(async () => RUN_TEMPLATE);
  const stopWorkflowRunNow = vi.fn<StoryState['stopWorkflowRunNow']>(async () => undefined);
  const discardWorkflow = vi.fn<StoryState['discardWorkflow']>(async () => undefined);
  useAppStore.setState({
    spawnAgent,
    attachWorkflowToSession,
    savePhaseTemplate,
    stopWorkflowRunNow,
    discardWorkflow,
    generateWorkflowTitle: vi.fn<StoryState['generateWorkflowTitle']>(async () => undefined),
  });
  return {
    spawnAgent,
    attachWorkflowToSession,
    savePhaseTemplate,
    stopWorkflowRunNow,
    discardWorkflow,
  };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    workspaceOverrides: {},
  });
});

describe('changeRunRoute', () => {
  it('switches Follow and Adapt in place, even after work started', async () => {
    seedPlanRun({ hasWork: true });
    const engines = mockEngines();

    const change = await changeRunRoute({
      target: planTarget,
      choice: { shape: 'plan', presetId: LAYOUT_ID, closeness: 'follow' },
    });

    expect(change).toBe('in-place');
    expect(runOf()?.rulesSnapshot?.route).toMatchObject({ closeness: 'follow', ask: ASK });
    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(engines.stopWorkflowRunNow).not.toHaveBeenCalled();
  });

  it('switches the preset before the first child and keeps the run', async () => {
    seedPlanRun({ hasWork: false });
    const engines = mockEngines();

    const change = await changeRunRoute({
      target: planTarget,
      choice: { shape: 'plan', presetId: AUDIT_ID, closeness: 'adapt' },
    });

    expect(change).toBe('in-place');
    expect(runOf()?.id).toBe(RUN_ID);
    expect(runOf()?.rulesSnapshot?.route).toMatchObject({ presetName: 'Audit pages', row: 1 });
    expect(runOf()?.rulesSnapshot?.preset).toMatchObject({
      workflowId: AUDIT_ID,
      name: 'Audit pages',
    });
    expect(engines.savePhaseTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: RUN_WORKFLOW, processText: '' }),
    );
    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
  });

  it('starts one agent in place of an empty plan, with nothing marked', async () => {
    seedPlanRun({ hasWork: false });
    const engines = mockEngines();

    const change = await changeRunRoute({
      target: planTarget,
      choice: { shape: 'lead', presetId: null, closeness: 'adapt' },
    });

    expect(change).toBe('restarted');
    expect(engines.spawnAgent).toHaveBeenCalledWith(
      SESSION.id,
      expect.objectContaining({ initialPrompt: ASK }),
    );
    expect(engines.discardWorkflow).toHaveBeenCalledWith(SESSION.id, RUN_ID);
  });

  it('after work started, starts a second run with what the first found and the first keeps going', async () => {
    seedPlanRun({ hasWork: true });
    const engines = mockEngines();

    const change = await changeRunRoute({
      target: planTarget,
      choice: { shape: 'lead', presetId: null, closeness: 'adapt' },
    });

    expect(change).toBe('second-run');
    const prompt = engines.spawnAgent.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(prompt).toContain(ASK);
    expect(prompt).toContain('Found the billing table');
    expect(prompt).toContain('The table scrolls sideways at 390px');
    expect(engines.stopWorkflowRunNow).not.toHaveBeenCalled();
    expect(runOf()?.rulesSnapshot?.route).toEqual(PLAN_ROUTE);
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[NEW_AGENT]).toMatchObject({ ask: ASK, shape: 'lead' });
  });

  it('leaves the first run as it was when the second run fails to start', async () => {
    seedPlanRun({ hasWork: true });
    const engines = mockEngines();
    engines.spawnAgent.mockRejectedValueOnce(new Error('No provider is connected'));

    await expect(
      changeRunRoute({
        target: planTarget,
        choice: { shape: 'lead', presetId: null, closeness: 'adapt' },
      }),
    ).rejects.toThrow('No provider is connected');

    expect(engines.stopWorkflowRunNow).not.toHaveBeenCalled();
    expect(runOf()?.rulesSnapshot?.route?.changedTo).toBeUndefined();
  });

  it('starts a plan with what one agent found and leaves the agent as it was', async () => {
    const root = anAgent({
      id: ROOT,
      sessionId: SESSION.id,
      name: 'Auto',
      status: 'completed',
      outputSummary: 'Three pages share the billing table',
    });
    useAppStore.setState({
      sessions: [SESSION],
      phaseTemplates: { [WORKSPACE.id]: [] },
      sessionPhaseRuns: { [SESSION.id]: [root] },
    });
    await writeRunRoute({
      db: storySqlite(),
      sessionId: SESSION.id,
      agentId: ROOT,
      route: {
        ...PLAN_ROUTE,
        shape: 'lead',
        presetName: null,
        closeness: null,
        choice: 'One agent',
      },
    });
    const engines = mockEngines();

    const change = await changeRunRoute({
      target: { kind: 'lead', sessionId: SESSION.id, agentId: ROOT },
      choice: { shape: 'plan', presetId: null, closeness: 'adapt' },
    });

    expect(change).toBe('second-run');
    const options = engines.attachWorkflowToSession.mock.calls[0]?.[2];
    expect(options?.goal).toContain('Three pages share the billing table');
    expect(options?.rulesSnapshot?.route).toMatchObject({ shape: 'plan', ask: ASK });
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[ROOT]).not.toHaveProperty('changedTo');
  });
});
