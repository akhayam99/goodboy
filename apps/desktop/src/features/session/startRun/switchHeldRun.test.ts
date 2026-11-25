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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { writeRunGuidance } from '../../../store/runtime/runGuidance/writeRunGuidance';
import { aView } from '../../auto/testing/autoViewFixtures';
import { registerTreeStopPort, type TreeStopPort } from '../../auto/treeStopPort';
import { OldRunLeftError } from './OldRunLeftError';
import { writeRunRoute } from './runRoutesSetting';
import { switchHeldRun } from './switchHeldRun';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Settlement export' });
const NOW = brandId<IsoDateTime>({ value: '2026-11-25T09:00:00.000Z' });
const BUG_ID = brandId<WorkflowId>({ value: 'workflow-bug' });
const FEATURE_ID = brandId<WorkflowId>({ value: 'workflow-feature' });
const ROOT = brandId<AgentId>({ value: 'agent-auto' });
const NEW_AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const ASK = 'Fix the rounding drift in the settlement export';
const GUIDANCE = 'Only touch the export module.';

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

const BUG_ROUTE: RunRoute = {
  shape: 'lead',
  row: 1,
  presetName: 'Fix a bug',
  workflowId: BUG_ID,
  closeness: 'follow',
  role: null,
  choice: 'Lead · plan Fix a bug',
  why: 'Your ask matches the workflow',
  ask: ASK,
};

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(() => {
  registerTreeStopPort({ port: null });
});

const seed = async () => {
  await resetStoryStore();
  await openStorySqlite();
  const view = aView();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    workspaceOverrides: {},
    sessions: [SESSION],
    phaseTemplates: {
      [WORKSPACE.id]: [presetOf(BUG_ID, 'Fix a bug'), presetOf(FEATURE_ID, 'Ship a feature')],
    },
    sessionPhaseRuns: {
      [SESSION.id]: [
        anAgent({
          id: ROOT,
          sessionId: SESSION.id,
          name: 'Auto',
          status: 'completed',
          outputSummary: 'Rounding each line matches the settlement spec',
        }),
      ],
    },
    autoTreeViews: { [SESSION.id]: [{ ...view, tree: { ...view.tree, rootAgentId: ROOT } }] },
  });
  await writeRunRoute({
    db: storySqlite(),
    sessionId: SESSION.id,
    agentId: ROOT,
    route: BUG_ROUTE,
  });
  await storySqlite().execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [WORKSPACE.id, 'Harborline', 'harborline', 1, 1],
  );
  await writeRunGuidance({
    db: storySqlite(),
    workspaceId: WORKSPACE.id,
    agentId: ROOT,
    text: GUIDANCE,
  });
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => NEW_AGENT);
  useAppStore.setState({ spawnAgent });
  return { spawnAgent, treeId: view.tree.id };
};

describe('switchHeldRun', () => {
  it('starts the suggested workflow with the findings and the guidance, then stops the held run', async () => {
    const { spawnAgent, treeId } = await seed();
    const stop = vi.fn<TreeStopPort>(async () => 'stopped');
    registerTreeStopPort({ port: stop });

    await switchHeldRun({
      sessionId: SESSION.id,
      agentId: ROOT,
      workflowId: FEATURE_ID,
    });

    const options = spawnAgent.mock.calls[0]?.[1];
    expect(options?.initialPrompt).toContain(ASK);
    expect(options?.initialPrompt).toContain('Rounding each line matches the settlement spec');
    expect(options?.initialPrompt).toContain('Ship a feature');
    expect(options?.guidance).toBe(GUIDANCE);
    expect(stop).toHaveBeenCalledWith({ treeId });
  });

  it('starts the second run with no provider or model carried from the first', async () => {
    const { spawnAgent } = await seed();
    registerTreeStopPort({ port: vi.fn<TreeStopPort>(async () => 'stopped') });

    await switchHeldRun({
      sessionId: SESSION.id,
      agentId: ROOT,
      workflowId: FEATURE_ID,
    });

    const options = spawnAgent.mock.calls[0]?.[1];
    expect(options).not.toHaveProperty('provider');
    expect(options).not.toHaveProperty('model');
    expect(options).not.toHaveProperty('effort');
  });

  it('keeps the held run and starts nothing when the second run cannot start', async () => {
    const { spawnAgent } = await seed();
    const stop = vi.fn<TreeStopPort>(async () => 'stopped');
    registerTreeStopPort({ port: stop });
    spawnAgent.mockRejectedValueOnce(new Error('No provider is connected'));

    await expect(
      switchHeldRun({
        sessionId: SESSION.id,
        agentId: ROOT,
        workflowId: FEATURE_ID,
      }),
    ).rejects.toThrow('No provider is connected');
    expect(stop).not.toHaveBeenCalled();
  });

  it('keeps the new run and offers a retry that only stops the old one', async () => {
    const { spawnAgent, treeId } = await seed();
    const stop = vi
      .fn<TreeStopPort>()
      .mockResolvedValueOnce('stuck')
      .mockResolvedValueOnce('stopped');
    registerTreeStopPort({ port: stop });

    const failure = await switchHeldRun({
      sessionId: SESSION.id,
      agentId: ROOT,
      workflowId: FEATURE_ID,
    }).catch((error: unknown) => error);

    if (!(failure instanceof OldRunLeftError)) {
      throw new Error('The switch should leave the old run');
    }
    expect(spawnAgent).toHaveBeenCalledTimes(1);
    await failure.endOldRun();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenLastCalledWith({ treeId });
    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('a second switch after the start only stops the old run', async () => {
    const { spawnAgent, treeId } = await seed();
    const stop = vi.fn<TreeStopPort>().mockResolvedValueOnce('stuck').mockResolvedValue('stopped');
    registerTreeStopPort({ port: stop });
    const params = { sessionId: SESSION.id, agentId: ROOT, workflowId: FEATURE_ID };

    await expect(switchHeldRun(params)).rejects.toBeInstanceOf(OldRunLeftError);
    await switchHeldRun(params);

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenLastCalledWith({ treeId });
    await switchHeldRun(params);
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });
});
