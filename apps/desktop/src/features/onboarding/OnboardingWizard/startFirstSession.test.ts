// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

const SESSION_ID = 'session-harborline-first' as SessionId;

const { store, setState } = vi.hoisted(() => ({
  store: {
    createSession: vi.fn(async () => ({ session: { id: 'session-harborline-first' } })),
    spawnAgent: vi.fn(async () => undefined),
    focusSessionSetupStep: vi.fn(),
  },
  setState: vi.fn(),
}));

vi.mock('../../../store', () => ({
  useAppStore: { getState: () => store, setState },
}));

import { scoutKickoffPrompt } from './scoutKickoffPrompt';
import { SCOUT_FIRST_TITLE, handOffFirstSession, startFirstScout } from './startFirstSession';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;

beforeEach(() => {
  store.createSession.mockClear();
  store.spawnAgent.mockClear();
  store.focusSessionSetupStep.mockClear();
  setState.mockClear();
});

describe('startFirstScout', () => {
  it('creates the first session in the picked project and starts Scout on the prompt', async () => {
    await startFirstScout({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      prompt: 'Find one small bug',
    });

    expect(store.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Find one small bug',
      title: 'Find one small bug',
      omitGoalSlot: false,
      projectId: PROJECT_ID,
    });
    expect(store.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'scout',
      initialPrompt: scoutKickoffPrompt({ focus: 'Find one small bug' }),
      focus: 'agent',
    });
    expect(setState).toHaveBeenCalledWith({ goodboyNamedSessionId: SESSION_ID });
  });

  it('names an empty focus after Scout and keeps the goal empty', async () => {
    await startFirstScout({ workspaceId: WORKSPACE_ID, projectId: null, prompt: '  ' });

    expect(store.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: SCOUT_FIRST_TITLE,
      title: SCOUT_FIRST_TITLE,
      omitGoalSlot: true,
    });
  });
});

describe('handOffFirstSession', () => {
  it('opens a blank session in the project on its Start the work step for a workflow', async () => {
    await handOffFirstSession({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      choice: 'workflow',
    });

    expect(store.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: '',
      omitGoalSlot: true,
      projectId: PROJECT_ID,
    });
    expect(store.focusSessionSetupStep).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      step: 'work',
    });
  });

  it('opens the Inbox for a task and creates nothing', async () => {
    const onInbox = vi.fn();
    window.addEventListener('goodboy:open-inbox', onInbox);

    await handOffFirstSession({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, choice: 'task' });

    window.removeEventListener('goodboy:open-inbox', onInbox);
    expect(onInbox).toHaveBeenCalledOnce();
    expect(store.createSession).not.toHaveBeenCalled();
  });
});
