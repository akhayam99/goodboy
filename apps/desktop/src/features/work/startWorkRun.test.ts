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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type ProjectId, type Session } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { StartSessionFromDraftParams } from '../../store/slices/sessionDraft/startSessionFromDraft';
import { startWorkRun } from './startWorkRun';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const VISITED = aSession({ workspaceId: WORKSPACE.id, goal: 'Billing pages' });
const CREATED = aSession({ workspaceId: WORKSPACE.id, goal: 'Stop retried webhooks' });
const PROJECT = brandId<ProjectId>({ value: 'project-payments-api' });
const AGENT = brandId<AgentId>({ value: 'agent-lead' });

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const mockEngine = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
  useAppStore.setState({ spawnAgent });
  return spawnAgent;
};

const draftPort = () =>
  vi.fn(async ({ start }: StartSessionFromDraftParams): Promise<Session> => {
    if (start.kind === 'task' && start.then?.kind === 'workflow-run') {
      await start.then.run(CREATED);
    }
    return CREATED;
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
    sessions: [VISITED, CREATED],
    workspaceOverrides: {},
  });
});

describe('startWorkRun', () => {
  it('from Work after visiting a session starts in a new session, not the visited one', async () => {
    const spawnAgent = mockEngine();
    const startFromDraft = draftPort();
    const started = await startWorkRun({
      target: { workspaceId: WORKSPACE.id, sessionId: null, projectId: PROJECT, branch: null },
      text: 'Stop retried webhooks',
      routing: null,
      startFromDraft,
    });
    expect(started.sessionId).toBe(CREATED.id);
    expect(startFromDraft).toHaveBeenCalledTimes(1);
    expect(spawnAgent).toHaveBeenCalledWith(
      CREATED.id,
      expect.objectContaining({ kindOverride: 'auto' }),
    );
    expect(spawnAgent).not.toHaveBeenCalledWith(VISITED.id, expect.anything());
  });

  it('puts the project and the branch of a branch row in the write', async () => {
    mockEngine();
    const startFromDraft = draftPort();
    await startWorkRun({
      target: {
        workspaceId: WORKSPACE.id,
        sessionId: null,
        projectId: PROJECT,
        branch: 'hl/retry-credit',
      },
      text: 'Stop retried webhooks',
      routing: null,
      startFromDraft,
    });
    const start = startFromDraft.mock.calls[0]?.[0].start;
    expect(start).toMatchObject({
      kind: 'task',
      mount: { projectId: PROJECT },
      checkout: { existingBranch: 'hl/retry-credit' },
    });
  });

  it('names the branch to a Lead started inside a session', async () => {
    const spawnAgent = mockEngine();
    const startFromDraft = draftPort();
    await startWorkRun({
      target: {
        workspaceId: WORKSPACE.id,
        sessionId: VISITED.id,
        projectId: null,
        branch: 'hl/retry-credit',
      },
      text: 'Stop retried webhooks',
      routing: null,
      startFromDraft,
    });
    expect(startFromDraft).not.toHaveBeenCalled();
    expect(spawnAgent).toHaveBeenCalledWith(
      VISITED.id,
      expect.objectContaining({ initialPrompt: expect.stringContaining('hl/retry-credit') }),
    );
  });

  it('starts one Lead on a double press', async () => {
    const spawnAgent = mockEngine();
    const startFromDraft = draftPort();
    const params = {
      target: { workspaceId: WORKSPACE.id, sessionId: VISITED.id, projectId: null, branch: null },
      text: 'Stop retried webhooks',
      routing: null,
      startFromDraft,
    };
    await Promise.all([startWorkRun(params), startWorkRun(params)]);
    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('rejects with the error and allows a retry after a failed start', async () => {
    const spawnAgent = vi
      .fn<StoryState['spawnAgent']>()
      .mockRejectedValueOnce(new Error('No provider is connected'))
      .mockResolvedValueOnce(AGENT);
    useAppStore.setState({ spawnAgent });
    const params = {
      target: { workspaceId: WORKSPACE.id, sessionId: VISITED.id, projectId: null, branch: null },
      text: 'Stop retried webhooks',
      routing: null,
      startFromDraft: draftPort(),
    };
    await expect(startWorkRun(params)).rejects.toThrow('No provider is connected');
    await expect(startWorkRun(params)).resolves.toEqual({ sessionId: VISITED.id });
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });
});
