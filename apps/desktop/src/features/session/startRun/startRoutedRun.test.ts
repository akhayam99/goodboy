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
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
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
  defaultShape: 'auto',
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
      why: 'A question or a check, and no preset fits',
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
    expect(options?.initialPrompt).toBe(
      [
        'the totals table',
        'Plan: follow the preset "Fix a layout".',
        '1. Find (scout)',
        'Keep these steps in their order. Ask before you add, skip or move one.',
      ].join('\n\n'),
    );
    expect((await readRoutes())[AGENT]).toMatchObject({
      shape: 'lead',
      row: 1,
      presetName: 'Fix a layout',
      closeness: 'follow',
      ask: 'the totals table',
    });
  });

  it('starts a Lead for an ask that matches a preset, free to adapt it', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(engines.spawnAgent.mock.calls[0]?.[1]?.initialPrompt).toContain(
      'You may add, skip or move a step. Say why when you do.',
    );
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

  it('hands no limit to the Lead when the run keeps the default', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    await startRoutedRun({ sessionId: SESSION.id, result, limit: { usd: null, source: null } });

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
