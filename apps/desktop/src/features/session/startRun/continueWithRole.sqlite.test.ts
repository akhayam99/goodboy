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
import { getSetting, listAutoOutbox } from '@goodboy/db';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type WorkspaceId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { invokeAgentList } from '../../workflows/workflows';
import { readRunGuidance } from '../../../store/runtime/runGuidance/readRunGuidance';
import { writeRunGuidance } from '../../../store/runtime/runGuidance/writeRunGuidance';
import { continueWithRole } from './continueWithRole';
import { runRoutesKey } from './runRoutesSetting';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });
const ROOT = brandId<AgentId>({ value: 'agent-auto-root' });
const STARTED = brandId<AgentId>({ value: 'agent-tester' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;
type SendFn = StoryState['sendTurn'];
type SpawnFn = StoryState['spawnAgent'];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite(), agentIds: ['agent-source'] });
  await storySqlite().execute(
    "UPDATE agents SET name = 'Scout', kind = 'scout', status = 'completed' WHERE id = ?",
    [SOURCE],
  );
  useAppStore.setState({
    sessions: [aSession({ id: AUTO_SEED_SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: await invokeAgentList(AUTO_SEED_SESSION) },
    agentTurnState: {},
    agentKindOverride: {},
    autoTreeViews: {},
    sessionBudgets: {},
    settings: {},
    transcripts: {},
  });
});

describe('continuing a run with a role', () => {
  it('hands an old agent to Auto with the card as what to do next', async () => {
    const outcome = await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'planner',
      work: 'Turn the scout report into a plan',
      sourceAgentId: SOURCE,
    });

    expect(outcome.kind).toBe('handed');
    const trees = useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION] ?? [];
    expect(trees).toHaveLength(1);
    const tree = trees[0];
    if (tree === undefined) {
      return;
    }
    const outbox = await listAutoOutbox({ db: storySqlite(), treeId: tree.tree.id });
    expect(JSON.stringify(outbox[0]?.payload)).toContain(
      'Continue with Planner: Turn the scout report into a plan',
    );
  });

  it('sends a message to the latest Auto run of the session instead of a new agent', async () => {
    const sendTurn = vi.fn<SendFn>(async () => ({ blockedOverBudget: false }));
    const spawnAgent = vi.fn<SpawnFn>(async () => STARTED);
    useAppStore.setState({
      sendTurn,
      spawnAgent,
      sessionPhaseRuns: {
        [AUTO_SEED_SESSION]: [
          anAgent({ id: ROOT, sessionId: AUTO_SEED_SESSION, kind: 'auto', ordinal: 4 }),
        ],
      },
    });

    const outcome = await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'tester',
      work: 'Writes tests for the changes',
      sourceAgentId: null,
    });

    expect(outcome).toEqual({ kind: 'message', agentId: ROOT });
    expect(sendTurn).toHaveBeenCalledWith({
      sessionId: AUTO_SEED_SESSION,
      agentId: ROOT,
      content: 'Continue with Tester: Writes tests for the changes',
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('starts that role at once as a run of one agent when no Auto run is there', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => STARTED);
    useAppStore.setState({ spawnAgent, sessionPhaseRuns: { [AUTO_SEED_SESSION]: [] } });

    const outcome = await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'tester',
      work: 'Writes tests for the changes',
      sourceAgentId: null,
    });

    expect(outcome).toEqual({ kind: 'started', agentId: STARTED });
    expect(spawnAgent).toHaveBeenCalledWith(
      AUTO_SEED_SESSION,
      expect.objectContaining({
        kindOverride: 'tester',
        initialPrompt: 'Writes tests for the changes',
      }),
    );
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: AUTO_SEED_SESSION }));
    expect(JSON.parse(raw ?? '{}')[STARTED]).toMatchObject({ row: 1, role: 'tester' });
  });

  it('throws what Auto said and starts nothing when the agent cannot be handed over', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => STARTED);
    useAppStore.setState({ spawnAgent });
    await storySqlite().execute("UPDATE agents SET status = 'running' WHERE id = ?", [SOURCE]);

    await expect(
      continueWithRole({
        sessionId: AUTO_SEED_SESSION,
        role: 'planner',
        work: 'Turn the scout report into a plan',
        sourceAgentId: SOURCE,
      }),
    ).rejects.toThrow();
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION] ?? []).toHaveLength(0);
  });
});

describe('continuing a run keeps its guidance', () => {
  const GUIDANCE = 'Keep every change inside ledger-core.';

  it('gives the Auto run that adopts an agent the guidance that agent had', async () => {
    await writeRunGuidance({
      db: storySqlite(),
      workspaceId: WORKSPACE,
      agentId: SOURCE,
      text: GUIDANCE,
    });

    const outcome = await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'planner',
      work: 'Turn the scout report into a plan',
      sourceAgentId: SOURCE,
    });

    expect(outcome.kind).toBe('handed');
    expect(
      await readRunGuidance({
        db: storySqlite(),
        workspaceId: WORKSPACE,
        agentId: outcome.agentId,
      }),
    ).toBe(GUIDANCE);
  });

  it('writes no guidance for the Auto run when the adopted agent had none', async () => {
    const outcome = await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'planner',
      work: 'Turn the scout report into a plan',
      sourceAgentId: SOURCE,
    });

    expect(
      await readRunGuidance({
        db: storySqlite(),
        workspaceId: WORKSPACE,
        agentId: outcome.agentId,
      }),
    ).toBeNull();
  });

  it('starts a new agent with the guidance it was given', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => STARTED);
    useAppStore.setState({ spawnAgent, sessionPhaseRuns: { [AUTO_SEED_SESSION]: [] } });

    await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'tester',
      work: 'Writes tests for the changes',
      sourceAgentId: null,
      guidance: GUIDANCE,
    });

    expect(spawnAgent).toHaveBeenCalledWith(
      AUTO_SEED_SESSION,
      expect.objectContaining({ kindOverride: 'tester', guidance: GUIDANCE }),
    );
  });

  it('starts a new agent with no guidance field when none was given', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => STARTED);
    useAppStore.setState({ spawnAgent, sessionPhaseRuns: { [AUTO_SEED_SESSION]: [] } });

    await continueWithRole({
      sessionId: AUTO_SEED_SESSION,
      role: 'tester',
      work: 'Writes tests for the changes',
      sourceAgentId: null,
    });

    expect(spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('guidance');
  });
});
