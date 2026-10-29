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
  type AgentId,
  type IsoDateTime,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { runRouteOf, type RunRouteFacts } from './runRouteOf';
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

  it('puts the reason of a plan in the rules the run starts with', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Fix the layout on every billing page' });

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

  it('keeps the reason of a run you picked by name', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: '~Fix a layout the totals table' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    const options = engines.attachWorkflowToSession.mock.calls[0]?.[2];
    expect(options?.rulesSnapshot?.route).toMatchObject({
      row: 1,
      presetName: 'Fix a layout',
      ask: 'the totals table',
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

  it('starts an orchestrated run with the orchestrator the person picked', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Fix the layout on every billing page' });

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

  it('starts an orchestrated run on the default orchestrator when none is picked', async () => {
    const engines = mockEngines();
    const result = routeOf({ text: 'Fix the layout on every billing page' });

    await startRoutedRun({ sessionId: SESSION.id, result });

    expect(engines.attachWorkflowToSession.mock.calls[0]?.[2]).not.toHaveProperty(
      'orchestratorRouting',
    );
  });
});
