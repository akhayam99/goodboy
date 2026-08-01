import { describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const { updateSessionActiveMount, tauriDatabase } = vi.hoisted(() => ({
  updateSessionActiveMount: vi.fn(async () => undefined),
  tauriDatabase: {},
}));

vi.mock('@goodboy/db', () => ({ updateSessionActiveMount }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase }));

import { setSessionActiveMount } from './setSessionActiveMount';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-web' as WorkspaceId;

describe('setSessionActiveMount', () => {
  it('persists the mount and invalidates integration state from the previous repo', async () => {
    const state = {
      sessions: [{ id: SESSION_ID }],
      sessionActiveMount: {},
      sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
      sessionGithubPrs: { [SESSION_ID]: [{ number: 42 }] },
      sessionGitlabMr: { [SESSION_ID]: { mr: { iid: 42 } } },
      sessionSelectedPrNumber: { [SESSION_ID]: 42 },
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });

    await setSessionActiveMount({ set: set as never })({
      sessionId: SESSION_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(state.sessionActiveMount).toEqual({ [SESSION_ID]: WORKSPACE_ID });
    expect(state.sessions[0]).toEqual({
      id: SESSION_ID,
      activeMountWorkspaceId: WORKSPACE_ID,
    });
    expect(state.sessionGithub[SESSION_ID]).toBeUndefined();
    expect(state.sessionGithubPrs[SESSION_ID]).toBeUndefined();
    expect(state.sessionGitlabMr[SESSION_ID]).toBeUndefined();
    expect(state.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
    expect(updateSessionActiveMount).toHaveBeenCalledWith({
      db: tauriDatabase,
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
    });
  });
});
