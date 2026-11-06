// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../chat/turn', async () => (await import('../../store/storyHarness')).turnModuleMock());
vi.mock('../budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { continueNotifiedAgent } from './continueNotifiedAgent';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const CHECKOUT = brandId<SessionId>({ value: 'session-northwind-checkout' });
const STOPPED = brandId<AgentId>({ value: 'agent-northwind-stopped' });

let useAppStore: StoryStore;
const continueStoppedAgent = vi.fn(async (_params: unknown) => undefined);
const reportError = vi.fn(async (_params: unknown) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  continueStoppedAgent.mockReset();
  continueStoppedAgent.mockResolvedValue(undefined);
  reportError.mockClear();
  const db = await openStorySqlite();
  const harborline = buildStoryWorkspace({
    id: HARBORLINE,
    name: 'Harborline',
    slug: 'harborline',
  });
  const northwind = buildStoryWorkspace({ id: NORTHWIND, name: 'Northwind', slug: 'northwind' });
  await insertWorkspace({ db, workspace: harborline });
  await insertWorkspace({ db, workspace: northwind });
  await insertSession(
    db,
    buildStorySession({ id: CHECKOUT, workspaceId: NORTHWIND, goal: 'Fix the checkout tests' }),
  );
  stubStoryInvoke({});
  useAppStore.setState({
    workspaces: [harborline, northwind],
    currentWorkspaceId: HARBORLINE,
    sessions: [],
    continueStoppedAgent,
    reportError,
  });
});

describe('continueNotifiedAgent', () => {
  it('opens the owning workspace before it continues an agent of another workspace', async () => {
    continueNotifiedAgent({ sessionId: CHECKOUT, agentId: STOPPED });

    await vi.waitFor(() => expect(continueStoppedAgent).toHaveBeenCalledOnce());
    expect(useAppStore.getState().currentWorkspaceId).toBe(NORTHWIND);
    expect(continueStoppedAgent).toHaveBeenCalledWith({ sessionId: CHECKOUT, agentId: STOPPED });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a failed continuation instead of dropping the rejection', async () => {
    continueStoppedAgent.mockRejectedValue(new Error('session not found'));

    continueNotifiedAgent({ sessionId: CHECKOUT, agentId: STOPPED });

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't continue the agent" }),
    );
  });

  it('reports a session that no longer exists', async () => {
    continueNotifiedAgent({
      sessionId: brandId<SessionId>({ value: 'session-gone' }),
      agentId: STOPPED,
    });

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(continueStoppedAgent).not.toHaveBeenCalled();
  });
});
