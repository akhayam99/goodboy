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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
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
import { ATTENTION_HANDLED_EVENT } from './attentionHandledEvent';
import { openAttentionTarget } from './openAttentionTarget';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const CHECKOUT = brandId<SessionId>({ value: 'session-northwind-checkout' });

let useAppStore: StoryStore;
const handled = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  handled.mockClear();
  globalThis.addEventListener(ATTENTION_HANDLED_EVENT, handled);
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
  });
});

afterEach(() => {
  globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, handled);
});

describe('openAttentionTarget', () => {
  it('lands a failed check of a workspace that was not on screen, never Already handled', async () => {
    const opening = await openAttentionTarget({
      target: { workspaceId: NORTHWIND, sessionId: CHECKOUT, reason: 'ci-failed', agentId: null },
    });

    expect(useAppStore.getState().currentWorkspaceId).toBe(NORTHWIND);
    expect(opening).toBe('landed');
    expect(handled).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentSessionId).toBe(CHECKOUT);
  });
});
