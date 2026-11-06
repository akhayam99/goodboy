import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findUndecidedPermissionAsk,
  insertAgent,
  insertSession,
  insertTurnEvent,
  insertWorkspace,
  listAgentsForSessions,
} from '@goodboy/db';
import type { AgentId, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { writeReloadIntent } from '../features/workspace/windowView';
import { flushTurnEvents } from './slices/transcripts/buffer';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../shared/lib/dbBoot', async () => (await import('./storyHarness')).dbBootModuleMock());
vi.mock('../features/onboarding/onboardingSettings', async () =>
  (await import('./storyHarness')).onboardingStoreModuleMock(),
);
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const HARBORLINE_ID = 'workspace-harborline' as WorkspaceId;
const LEDGER_ID = 'session-ledger' as SessionId;
const AGENT_ID = 'agent-ledger' as AgentId;
const RUN_ID = 'run-ledger-ask' as ProviderRunId;
const TOOL_USE_ID = 'tool-ledger-migrate';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: HARBORLINE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Migrate ledger-core' }),
  );
  await insertAgent(db, {
    id: AGENT_ID,
    sessionId: LEDGER_ID,
    ordinal: 0,
    name: 'implementer',
    status: 'running',
    providerRunId: RUN_ID,
  });
  await insertTurnEvent(db, {
    id: 'event-ledger-ask',
    sessionId: LEDGER_ID,
    agentId: AGENT_ID,
    event: {
      kind: 'permission_request',
      runId: RUN_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      input: { command: 'pnpm db:migrate' },
      at: STORY_NOW,
    },
  });
  stubStoryInvoke({ turn_list_live: () => [] });
  writeReloadIntent({
    mode: 'restore',
    workspaceId: HARBORLINE_ID,
    sessionId: LEDGER_ID,
    agentId: AGENT_ID,
  });
});

const savedStatus = async (): Promise<string | undefined> =>
  (await listAgentsForSessions(storySqlite(), [LEDGER_ID]))
    .get(LEDGER_ID)
    ?.find((agent) => agent.id === AGENT_ID)?.status;

describe('store on sqlite: a waiting permission across a reload', () => {
  it('still needs you after the reload, and the card answers it', async () => {
    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().bootPhase).toBe('ready');
    expect(await savedStatus()).toBe('running');
    const agent = useAppStore
      .getState()
      .sessionPhaseRuns[LEDGER_ID]?.find((run) => run.id === AGENT_ID);
    expect(agent?.status).toBe('running');
    expect(useAppStore.getState().agentTurnState[AGENT_ID]).toMatchObject({
      kind: 'blocked',
      runId: RUN_ID,
    });
    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[AGENT_ID]).toContainEqual(
        expect.objectContaining({ kind: 'permission_request', toolUseId: TOOL_USE_ID }),
      );
    });

    await useAppStore.getState().resolvePermissionRequest({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      runId: RUN_ID,
      scope: 'once',
    });
    flushTurnEvents();

    await vi.waitFor(async () => {
      expect(
        await findUndecidedPermissionAsk({ db: storySqlite(), agentId: AGENT_ID, runId: RUN_ID }),
      ).toBeNull();
    });
  });
});
