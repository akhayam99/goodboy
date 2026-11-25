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
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProjectId,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { aMountView } from '../testing/aMountView';
import { olderPlanRouteOf } from './routeChoiceOf';
import { runAsRouteOf } from './runAsOf';
import { runRouteOf, type RunRouteFacts, type RunRouteResult } from './runRouteOf';
import { parseRunRoutes, runRoutesKey } from './runRoutesSetting';
import { startRoutedRun } from './startRoutedRun';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Billing pages' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const LAYOUT_ID = brandId<WorkflowId>({ value: 'workflow-layout' });

const LAYOUT: Workflow = {
  id: LAYOUT_ID,
  workspaceId: WORKSPACE.id,
  name: 'Fix a layout',
  description: 'Find the broken layout, fix it and check the page again',
  steps: [
    {
      id: brandId<StepId>({ value: 'workflow-layout-find' }),
      workflowId: LAYOUT_ID,
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
};

const FACTS: RunRouteFacts = {
  text: '',
  presets: [LAYOUT],
  roles: [],
  lastPresetId: null,
  hasTask: false,
  mountCount: 1,
  pullRequest: null,
  fileCount: 0,
};

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const mockEngines = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
  const attachWorkflowToSession = vi.fn<StoryState['attachWorkflowToSession']>(
    async () => undefined,
  );
  const savePhaseTemplate = vi.fn<StoryState['savePhaseTemplate']>(async () => LAYOUT);
  useAppStore.setState({
    spawnAgent,
    attachWorkflowToSession,
    savePhaseTemplate,
    generateWorkflowTitle: vi.fn<StoryState['generateWorkflowTitle']>(async () => undefined),
  });
  return { spawnAgent, attachWorkflowToSession };
};

type RouteOfParams = {
  readonly text: string;
};

const routeOf = ({ text }: RouteOfParams) => runRouteOf({ facts: { ...FACTS, text } });

const olderPlanOf = ({ text }: RouteOfParams): RunRouteResult => ({
  route: olderPlanRouteOf({
    preset: LAYOUT,
    closeness: 'adapt',
    row: 2,
    why: 'Your ask matches the preset',
  }),
  ask: text,
  preset: LAYOUT,
  role: null,
});

const readRoutes = async (): Promise<Readonly<Record<string, RunRoute>>> =>
  parseRunRoutes({
    raw: await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id })),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: { [WORKSPACE.id]: [LAYOUT] },
  });
});

describe('startRoutedRun keeps the reason with the run', () => {
  it('writes the reason of an agent run next to its agent id', async () => {
    mockEngines();
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    const started = await startRoutedRun({ sessionId: SESSION.id, result });

    expect(started).toEqual({ kind: 'lead', agentId: AGENT });
    expect((await readRoutes())[AGENT]).toMatchObject({
      shape: 'lead',
      row: 5,
      why: 'A question or a check',
      ask: 'Why does the ledger-core importer drop rows?',
    });
  });

  it('keeps the plan engine for an older run and puts its reason in its rules', async () => {
    const engines = mockEngines();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    const started = await startRoutedRun({ sessionId: SESSION.id, result });

    expect(started.kind).toBe('plan');
    const options = engines.attachWorkflowToSession.mock.calls[0]?.[2];
    expect(options?.rulesSnapshot?.route).toMatchObject({
      shape: 'plan',
      row: 2,
      presetName: 'Fix a layout',
      why: 'Your ask matches the preset',
      ask: 'Fix the layout on every billing page',
    });
    expect(engines.spawnAgent).not.toHaveBeenCalled();
  });

  it('starts a Lead with the preset you named as its plan', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    const started = await startRoutedRun({ sessionId: SESSION.id, result });

    expect(started).toEqual({ kind: 'lead', agentId: AGENT });
    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    const options = engines.spawnAgent.mock.calls[0]?.[1];
    expect(options?.kindOverride).toBe('auto');
    expect(options?.initialPrompt).toBe('the totals table');
    expect((await readRoutes())[AGENT]).toMatchObject({
      shape: 'lead',
      row: 1,
      presetName: 'Fix a layout',
      closeness: 'follow',
      ask: 'the totals table',
    });
  });

  it('hands the children the model pinned on a preset step and the Lead no brief', async () => {
    const engines = mockEngines();
    const lock = {
      version: 1,
      pick: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
      origin: 'user',
    } as const;
    const pinned: Workflow = {
      ...LAYOUT,
      steps: LAYOUT.steps.map((step) => ({ ...step, role: 'implementer', routingLock: lock })),
    };
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [pinned] } });
    const result = runRouteOf({
      facts: { ...FACTS, presets: [pinned], text: '~Fix a layout the totals table' },
    });

    await startRoutedRun({ sessionId: SESSION.id, result });

    const options = engines.spawnAgent.mock.calls[0]?.[1];
    expect(options?.initialPrompt).toBe('the totals table');
    expect(options?.stepLocks).toEqual([{ role: 'implementer', routingLock: lock }]);
  });

  it('hands no pinned model when no step of the preset is pinned', async () => {
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: routeOf({ text: '~Fix a layout the totals table' }),
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('stepLocks');
  });

  it('starts a Lead with no workflow for an ask that only matches one', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(engines.spawnAgent.mock.calls[0]?.[1]?.initialPrompt).toBe(
      'Fix the layout on every billing page',
    );
  });

  it('starts a Lead free to adapt the workflow picked, with the ask alone', async () => {
    const engines = mockEngines();
    const result = runAsRouteOf({
      runAs: { kind: 'preset', presetId: LAYOUT.id, closeness: 'adapt' },
      facts: { ...FACTS, text: 'Fix the layout on every billing page' },
    });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(engines.spawnAgent.mock.calls[0]?.[1]?.initialPrompt).toBe(
      'Fix the layout on every billing page',
    );
    expect((await readRoutes())[AGENT]).toMatchObject({
      presetName: 'Fix a layout',
      closeness: 'adapt',
    });
  });

  it('sends the ask alone when one role runs it', async () => {
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: { ...routeOf({ text: '~Fix a layout the totals table' }), role: 'implementer' },
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'implementer',
      initialPrompt: 'the totals table',
    });
  });

  it('writes no reason when the agent fails to start', async () => {
    useAppStore.setState({
      spawnAgent: vi.fn<StoryState['spawnAgent']>(async () => {
        throw new Error('The agent could not start');
      }),
    });
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    await expect(startRoutedRun({ sessionId: SESSION.id, result })).rejects.toThrow(
      'The agent could not start',
    );

    expect(await readRoutes()).toEqual({});
  });
});

describe('startRoutedRun files the Lead on its branch', () => {
  const API = aMountView({
    key: 'payments-api',
    sessionId: SESSION.id,
    projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
    projectName: 'payments-api',
    branch: 'fix/duplicate-credit',
  });
  const LEDGER = aMountView({
    key: 'ledger-core',
    sessionId: SESSION.id,
    projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
    projectName: 'ledger-core',
    branch: 'rec/2-backfill',
  });

  it('records the only mount of the session on the Lead it spawns', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API] } });
    const engines = mockEngines();

    await startRoutedRun({ sessionId: SESSION.id, result: routeOf({ text: 'Fix the totals' }) });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      mountId: API.id,
    });
  });

  it('records no mount when two mounts share the session', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API, LEDGER] } });
    const engines = mockEngines();

    await startRoutedRun({ sessionId: SESSION.id, result: routeOf({ text: 'Fix the totals' }) });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('mountId');
  });

  it('leaves the mount of a one role run to its turn', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API] } });
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: { ...routeOf({ text: 'Fix the totals' }), role: 'implementer' },
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('mountId');
  });
});

describe('startRoutedRun links a run to the comments it comes from', () => {
  const API = aMountView({
    key: 'payments-api',
    sessionId: SESSION.id,
    projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
    projectName: 'payments-api',
    branch: 'fix/duplicate-credit',
  });
  const LEDGER = aMountView({
    key: 'ledger-core',
    sessionId: SESSION.id,
    projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
    projectName: 'ledger-core',
    branch: 'rec/2-backfill',
  });
  const HEADER_NOTE = 'note:note-ledger-header';
  const LAYOUT_THREAD = 'PRRT_harborline_ledger_layout';

  it('starts the Lead with every comment it comes from, on the branch of the comments', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API, LEDGER] } });
    const engines = mockEngines();

    const started = await startRoutedRun({
      sessionId: SESSION.id,
      result: routeOf({ text: 'Move the ledger header into AppLayout' }),
      sourceThreadIds: [HEADER_NOTE, LAYOUT_THREAD, HEADER_NOTE],
      sourceMountId: LEDGER.id,
    });

    expect(started).toEqual({ kind: 'lead', agentId: AGENT });
    expect(engines.spawnAgent.mock.calls[0]?.[0]).toBe(SESSION.id);
    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      mountId: LEDGER.id,
      sourceKind: 'comment_run',
      sourceThreadIds: [HEADER_NOTE, LAYOUT_THREAD],
    });
  });

  it('links the one agent of a role run to its comment', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API] } });
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: { ...routeOf({ text: 'Move the ledger header' }), role: 'implementer' },
      sourceThreadIds: [LAYOUT_THREAD],
      sourceMountId: API.id,
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'implementer',
      mountId: API.id,
      sourceKind: 'comment_run',
      sourceThreadIds: [LAYOUT_THREAD],
    });
  });

  it('starts nothing when the branch of the comments left the session', async () => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: [API] } });
    const engines = mockEngines();

    await expect(
      startRoutedRun({
        sessionId: SESSION.id,
        result: routeOf({ text: 'Move the ledger header into AppLayout' }),
        sourceThreadIds: [HEADER_NOTE],
        sourceMountId: LEDGER.id,
      }),
    ).rejects.toThrow('This branch is no longer part of the session');

    expect(engines.spawnAgent).not.toHaveBeenCalled();
    expect(await readRoutes()).toEqual({});
  });

  it('starts no second run for a comment another window already put in a run', async () => {
    const engines = mockEngines();
    const running = anAgent({
      id: brandId<AgentId>({ value: 'agent-ledger-header-run' }),
      sessionId: SESSION.id,
      ordinal: 1,
      status: 'running',
      kind: 'auto',
      sourceKind: 'comment_run',
      sourceThreadIds: [HEADER_NOTE],
    });
    useAppStore.setState({ sessionPhaseRuns: { [SESSION.id]: [running] } });

    await expect(
      startRoutedRun({
        sessionId: SESSION.id,
        result: routeOf({ text: 'Move the ledger header into AppLayout' }),
        sourceThreadIds: [LAYOUT_THREAD, HEADER_NOTE],
      }),
    ).rejects.toThrow('A comment you picked is already in a run');

    expect(engines.spawnAgent).not.toHaveBeenCalled();
    expect(await readRoutes()).toEqual({});
  });

  it('starts a run for a comment whose earlier run was stopped', async () => {
    const engines = mockEngines();
    const stopped = anAgent({
      id: brandId<AgentId>({ value: 'agent-ledger-header-stopped' }),
      sessionId: SESSION.id,
      ordinal: 1,
      status: 'stopped',
      kind: 'auto',
      sourceKind: 'comment_run',
      sourceThreadIds: [HEADER_NOTE],
    });
    useAppStore.setState({ sessionPhaseRuns: { [SESSION.id]: [stopped] } });

    await startRoutedRun({
      sessionId: SESSION.id,
      result: routeOf({ text: 'Move the ledger header into AppLayout' }),
      sourceThreadIds: [HEADER_NOTE],
      findings: 'The comments this run comes from, word for word:',
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      sourceThreadIds: [HEADER_NOTE],
      initialPrompt:
        'Move the ledger header into AppLayout\n\nThe comments this run comes from, word for word:',
    });
  });

  it('refuses a plan for comments before it writes anything', async () => {
    const engines = mockEngines();

    await expect(
      startRoutedRun({
        sessionId: SESSION.id,
        result: olderPlanOf({ text: 'Fix the layout on every billing page' }),
        sourceThreadIds: [LAYOUT_THREAD],
      }),
    ).rejects.toThrow('A run from comments starts with the Lead');

    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(engines.spawnAgent).not.toHaveBeenCalled();
  });

  it('starts a plain run with no source when no comment is named', async () => {
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: routeOf({ text: 'Fix the totals' }),
      sourceThreadIds: [],
    });

    const options = engines.spawnAgent.mock.calls[0]?.[1];
    expect(options).not.toHaveProperty('sourceKind');
    expect(options).not.toHaveProperty('sourceThreadIds');
  });
});

describe('startRoutedRun pins the model of one run', () => {
  it('passes the pinned routing to the Auto agent it spawns', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    await startRoutedRun({
      sessionId: SESSION.id,
      result,
      routing: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      effort: 'high',
    });
  });

  it('leaves the model to the defaults when nothing is pinned', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    const options = engines.spawnAgent.mock.calls[0]?.[1];
    expect(options).not.toHaveProperty('model');
    expect(options).not.toHaveProperty('provider');
  });

  it('resumes an older orchestrated run with the orchestrator the person picked', async () => {
    const engines = mockEngines();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({
      sessionId: SESSION.id,
      result,
      orchestratorRouting: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      orchestratorRouting: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    });
  });

  it('resumes an older orchestrated run on the default orchestrator', async () => {
    const engines = mockEngines();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]).not.toHaveProperty(
      'orchestratorRouting',
    );
  });
});

describe('startRoutedRun carries the guidance of one run', () => {
  const withWorkspaceGuidance = (): void => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, standingGuidance: 'Workspace default.' },
        },
      },
    });
  };

  it('passes the guidance to the agent it spawns', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    await startRoutedRun({
      sessionId: SESSION.id,
      result,
      guidance: 'Keep every answer under ten lines.',
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      guidance: 'Keep every answer under ten lines.',
    });
  });

  it('adds no guidance to an agent when none is given', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Why does the ledger-core importer drop rows?' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('guidance');
  });

  it('snapshots the guidance of an orchestrated run over the workspace value', async () => {
    const engines = mockEngines();
    withWorkspaceGuidance();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({
      sessionId: SESSION.id,
      result,
      guidance: '  Only touch the billing pages.  ',
    });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: 'Only touch the billing pages.',
    });
  });

  it('keeps the workspace guidance when the run has none of its own', async () => {
    const engines = mockEngines();
    withWorkspaceGuidance();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result, guidance: null });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: 'Workspace default.',
    });
  });

  it('starts a run without guidance when the person cleared the workspace value', async () => {
    const engines = mockEngines();
    withWorkspaceGuidance();
    const result = olderPlanOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result, guidance: '' });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: '',
    });
  });
});

describe('startRoutedRun carries the limit of one run', () => {
  it('hands the picked limit to the Lead a preset starts', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    await startRoutedRun({ sessionId: SESSION.id, result, limit: { usd: 3, source: 'run' } });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      limitUsd: 3,
    });
  });

  it('hands the Lead an explicit no limit when the person chose none', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    await startRoutedRun({ sessionId: SESSION.id, result, limit: { usd: null, source: null } });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({ limitUsd: null });
  });

  it('leaves the limit to the workspace when the start had no limit to pass', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    await startRoutedRun({ sessionId: SESSION.id, result, limit: null });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('limitUsd');
  });

  it('hands no limit to one role, which runs outside a Lead tree', async () => {
    const engines = mockEngines();

    await startRoutedRun({
      sessionId: SESSION.id,
      result: { ...routeOf({ text: '~Fix a layout the totals table' }), role: 'implementer' },
      limit: { usd: 3, source: 'run' },
    });

    expect(engines.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('limitUsd');
  });
});
