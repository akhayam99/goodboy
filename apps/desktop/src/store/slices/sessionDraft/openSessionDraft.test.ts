// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { SESSION_DRAFT_PLACE, sessionPlace } from '../navigation/place';
import { openSessionDraft } from './openSessionDraft';

const WORKSPACE_ID = 'ws-cascadia' as WorkspaceId;
const PROJECT_ID = 'proj-cascadia' as ProjectId;
const lapSession = aSession({ workspaceId: WORKSPACE_ID });

const makeState = (stage: 'first-lap' | 'done') => {
  const navigate = vi.fn();
  const ensureFirstLapSession = vi.fn(async () => lapSession);
  const state = {
    ...useAppStore.getState(),
    currentWorkspaceId: WORKSPACE_ID,
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, kind: 'repo' })],
    bootstrapPhase: {
      [PROJECT_ID]: {
        stage,
        firstLapSessionId: lapSession.id,
        bootstrapSessionId: null,
        snapshotId: null,
        worktreePath: null,
        branch: null,
        updatedAt: TEST_NOW,
      },
    },
    navigate,
    ensureFirstLapSession,
  };
  return { state, navigate, ensureFirstLapSession };
};

describe('openSessionDraft', () => {
  it('opens the first lap session instead of a second draft while the project is in its first lap', async () => {
    const { state, navigate, ensureFirstLapSession } = makeState('first-lap');

    openSessionDraft(() => state)();

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: lapSession.id }) }),
    );
    expect(ensureFirstLapSession).toHaveBeenCalledWith({ projectId: PROJECT_ID });
  });

  it('opens the draft as usual once the project is ordinary', () => {
    const { state, navigate, ensureFirstLapSession } = makeState('done');

    openSessionDraft(() => state)();

    expect(navigate).toHaveBeenCalledWith({ to: SESSION_DRAFT_PLACE });
    expect(ensureFirstLapSession).not.toHaveBeenCalled();
  });

  it('falls back to the draft when the first lap session cannot be opened', async () => {
    const { state, navigate, ensureFirstLapSession } = makeState('first-lap');
    ensureFirstLapSession.mockRejectedValueOnce(new Error('no provider'));

    openSessionDraft(() => state)();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: SESSION_DRAFT_PLACE }));
  });
});
