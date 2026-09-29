// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    startSessionFromDraft: vi.fn(async () => undefined),
    patchSessionDraft: vi.fn(),
    openSessionDraft: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: { getState: () => store },
}));

import { scoutKickoffPrompt } from '../../session/components/SessionKickoff/AgentStart';
import { handOffFirstSession, startFirstScout } from './startFirstSession';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;

beforeEach(() => {
  store.startSessionFromDraft.mockClear();
  store.patchSessionDraft.mockClear();
  store.openSessionDraft.mockClear();
});

describe('startFirstScout', () => {
  it('starts the first session from a scout draft in the picked project, the prompt as its focus', async () => {
    await startFirstScout({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      prompt: 'Find one small bug',
    });

    expect(store.patchSessionDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      patch: { projectId: PROJECT_ID },
    });

    expect(store.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'scout',
        focus: 'Find one small bug',
        prompt: scoutKickoffPrompt({ focus: 'Find one small bug' }),
        routing: null,
      },
    });
  });
});

describe('handOffFirstSession', () => {
  it('opens the session draft on the picked choice and project', () => {
    handOffFirstSession({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, choice: 'workflow' });

    expect(store.patchSessionDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      patch: { choice: 'workflow', projectId: PROJECT_ID },
    });
    expect(store.openSessionDraft).toHaveBeenCalledOnce();
  });
});
