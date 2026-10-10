import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertSession, insertWorkspace, listAgentsForSessions } from '@goodboy/db';
import type { AgentId, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
} from './storyHarness';
import { writeTurnCursor } from '../features/chat/turnCursor';
import { reconcileGhostAgents } from './slices/sessions/reconcileSessionRuns';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
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

const HARBORLINE_ID = 'workspace-harborline' as WorkspaceId;
const NORTHWIND_ID = 'workspace-northwind' as WorkspaceId;
const LEDGER_ID = 'session-ledger' as SessionId;
const ONBOARDING_ID = 'session-onboarding' as SessionId;

const harborline = buildStoryWorkspace({
  id: HARBORLINE_ID,
  name: 'Harborline',
  slug: 'harborline',
});
const northwind = buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly status: 'running' | 'completed';
};

const seedAgent = async ({ id, sessionId, runId, status }: SeedParams): Promise<void> => {
  await insertAgent(storySqlite(), {
    id: id as AgentId,
    sessionId,
    ordinal: 0,
    name: 'implementer',
    status,
    providerRunId: runId as ProviderRunId,
  });
};

const statusOf = async (sessionId: SessionId): Promise<Record<string, string>> => {
  const agents = (await listAgentsForSessions(storySqlite(), [sessionId])).get(sessionId) ?? [];
  return Object.fromEntries(agents.map((agent) => [agent.id, agent.status]));
};

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await insertWorkspace({ db, workspace: northwind });
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Reconcile the ledger' }),
  );
  await insertSession(
    db,
    buildStorySession({
      id: ONBOARDING_ID,
      workspaceId: NORTHWIND_ID,
      goal: 'Plan the Northwind onboarding',
    }),
  );
});

describe('store on sqlite: ghost running agents at boot', () => {
  it('stops the running agent of a workspace that is not open and keeps the live one', async () => {
    await seedAgent({
      id: 'agent-live',
      sessionId: LEDGER_ID,
      runId: 'run-live',
      status: 'running',
    });
    await seedAgent({
      id: 'agent-ghost',
      sessionId: ONBOARDING_ID,
      runId: 'run-ghost',
      status: 'running',
    });
    await seedAgent({
      id: 'agent-done',
      sessionId: ONBOARDING_ID,
      runId: 'run-done',
      status: 'completed',
    });
    stubStoryInvoke({ turn_list_live: () => ['run-live'] });

    const stopped = await reconcileGhostAgents();

    expect(stopped).toBe(1);
    expect(await statusOf(ONBOARDING_ID)).toEqual({
      'agent-ghost': 'stopped',
      'agent-done': 'completed',
    });
    expect(await statusOf(LEDGER_ID)).toEqual({ 'agent-live': 'running' });
  });

  it('keeps a run this window can still reattach to', async () => {
    await seedAgent({
      id: 'agent-reload',
      sessionId: ONBOARDING_ID,
      runId: 'run-reload',
      status: 'running',
    });
    writeTurnCursor({
      runId: 'run-reload' as ProviderRunId,
      cursor: { seq: 4, index: 2, owner: null },
    });
    stubStoryInvoke({ turn_list_live: () => [] });

    expect(await reconcileGhostAgents()).toBe(0);
    expect(await statusOf(ONBOARDING_ID)).toEqual({ 'agent-reload': 'running' });
  });

  it('stops nothing when the live runs cannot be read', async () => {
    await seedAgent({
      id: 'agent-ghost',
      sessionId: ONBOARDING_ID,
      runId: 'run-ghost',
      status: 'running',
    });
    stubStoryInvoke({
      turn_list_live: () => {
        throw new Error('backend unavailable');
      },
    });

    expect(await reconcileGhostAgents()).toBe(0);
    expect(await statusOf(ONBOARDING_ID)).toEqual({ 'agent-ghost': 'running' });
  });
});
