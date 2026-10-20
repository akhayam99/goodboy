import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import {
  brandId,
  type Agent,
  type AgentId,
  type ProjectId,
  type SessionId,
  type TurnEvent,
  type WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;
const phaseRunInsertSpy = storySpies.invokeAgentInsert;
const phaseRunListSpy = storySpies.invokeAgentList;

async function* emptyStream(): AsyncIterable<TurnEvent> {}

const WS_ID = brandId<WorkspaceId>({ value: 'ws-1' });
const DECISION = 'Round once per batch in settle_batch, never in post_line.';
const SUMMARY = 'Every posting rounds itself, 3,100 lines per batch.';
const GOAL = 'Settlement totals are off by a few cents per batch';

let inserted: Agent[] = [];

const wireDefaults = () => {
  storySpies.getWorkspaceById.mockImplementation(async ({ id }) =>
    buildStoryWorkspace({ id, name: 'Harborline', slug: 'harborline' }),
  );
  storySpies.listProjectsForWorkspace.mockImplementation(async ({ workspaceId }) => [
    buildStoryProject({
      id: brandId<ProjectId>({ value: 'project-1' }),
      workspaceId,
      name: 'ledger-core',
      rootPath: '/tmp',
    }),
  ]);
  storySpies.listWorkspaces.mockImplementation(async () => [
    buildStoryWorkspace({ id: WS_ID, name: 'Harborline' }),
  ]);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'nw/settle',
    slug: 'settle',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
  inserted = [];
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const sessionId = args['sessionId'];
    const ordinal = args['ordinal'];
    const name = args['name'];
    const row: Agent = {
      id: brandId<AgentId>({ value: `agent-${inserted.length + 1}` }),
      sessionId: brandId<SessionId>({ value: typeof sessionId === 'string' ? sessionId : '' }),
      ordinal: typeof ordinal === 'number' ? ordinal : 0,
      name: typeof name === 'string' ? name : '',
      status: 'pending',
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockImplementation(async () => inserted);
};

const sentText = (): string => {
  const args = runTurnSpy.mock.calls.at(-1)?.[0];
  return `${String(args?.systemPrompt)}\n${String(args?.prompt)}`;
};

const routeTo = async () => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('what an Auto child reads of the session', () => {
  beforeEach(() => {
    resetStorySpies();
    wireDefaults();
    useAppStore.setState({ agentRunHistory: {}, transcripts: {}, agentHandoffs: {} });
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const implementerSession = async () => {
    await routeTo();
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: GOAL,
      branchPrefix: 'nw',
    });
    const agentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { name: 'Implementer', kindOverride: 'implementer' });
    await settle();
    useAppStore.setState((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [session.id]: [
          { key: 'goal', value: GOAL, enabled: true },
          { key: 'decisions', value: `- D27 ${DECISION}`, enabled: true },
          { key: 'open_questions', value: '- Who owns the rounding fixture?', enabled: true },
          { key: 'files_touched', value: 'src/settle_batch.ts', enabled: true },
          { key: 'last_output_summary', value: SUMMARY, enabled: true },
        ],
      },
    }));
    runTurnSpy.mockClear();
    return { sessionId: session.id, agentId };
  };

  it('drops decisions, questions, files and summary of a version 2 child and keeps the goal', async () => {
    const { sessionId, agentId } = await implementerSession();

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: '**Task** Move the rounding.',
      origin: 'delegation',
      confinedRole: 'implementer',
      briefVersion: 2,
    });

    const text = sentText();
    expect(text).toContain(GOAL);
    expect(text).toContain('**Task** Move the rounding.');
    expect(text).not.toContain(DECISION);
    expect(text).not.toContain('Who owns the rounding fixture');
    expect(text).not.toContain('src/settle_batch.ts');
    expect(text).not.toContain(SUMMARY);
  });

  it('keeps every slot for a version 1 child of an older delegation', async () => {
    const { sessionId, agentId } = await implementerSession();

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: '**Task** Move the rounding.',
      origin: 'delegation',
      confinedRole: 'implementer',
    });

    const text = sentText();
    expect(text).toContain(DECISION);
    expect(text).toContain(SUMMARY);
  });

  it('keeps every slot for an implementer the user started by hand', async () => {
    const { sessionId, agentId } = await implementerSession();

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Move the rounding.',
      origin: 'operator',
      briefVersion: 2,
    });

    const text = sentText();
    expect(text).toContain(DECISION);
    expect(text).toContain(SUMMARY);
  });
});
