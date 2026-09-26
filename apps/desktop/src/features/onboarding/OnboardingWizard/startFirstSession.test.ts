import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

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

import { scoutKickoffPrompt } from '../../session/components/SessionKickoff/ScoutStart';
import { handOffFirstSession, startFirstScout } from './startFirstSession';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

beforeEach(() => {
  store.startSessionFromDraft.mockClear();
  store.patchSessionDraft.mockClear();
  store.openSessionDraft.mockClear();
});

describe('startFirstScout', () => {
  it('starts the first session from a scout draft with the chosen prompt as its focus', async () => {
    await startFirstScout({ workspaceId: WORKSPACE_ID, prompt: 'Find one small bug' });

    expect(store.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        focus: 'Find one small bug',
        prompt: scoutKickoffPrompt({ focus: 'Find one small bug' }),
      },
    });
  });
});

describe('handOffFirstSession', () => {
  it('opens the session draft on the picked choice', () => {
    handOffFirstSession({ workspaceId: WORKSPACE_ID, choice: 'workflow' });

    expect(store.patchSessionDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      patch: { choice: 'workflow' },
    });
    expect(store.openSessionDraft).toHaveBeenCalledOnce();
  });
});
