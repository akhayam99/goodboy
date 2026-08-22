import { describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';

const { updateSessionActiveProject, tauriDatabase } = vi.hoisted(() => ({
  updateSessionActiveProject: vi.fn(async () => undefined),
  tauriDatabase: {},
}));

vi.mock('@goodboy/db', () => ({ updateSessionActiveProject }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase }));

import { setSessionActiveProject } from './setSessionActiveMount';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-web' as ProjectId;

describe('setSessionActiveProject', () => {
  it('persists the mount and invalidates integration state from the previous repo', async () => {
    const state = {
      sessions: [{ id: SESSION_ID }],
      sessionActiveProject: {},
      sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
      sessionGithubPrs: { [SESSION_ID]: [{ number: 42 }] },
      sessionGitlabMr: { [SESSION_ID]: { mr: { iid: 42 } } },
      sessionSelectedPrNumber: { [SESSION_ID]: 42 },
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });

    await setSessionActiveProject({ set: set as never })({
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
    });

    expect(state.sessionActiveProject).toEqual({ [SESSION_ID]: PROJECT_ID });
    expect(state.sessions[0]).toEqual({
      id: SESSION_ID,
      activeProjectId: PROJECT_ID,
    });
    expect(state.sessionGithub[SESSION_ID]).toBeUndefined();
    expect(state.sessionGithubPrs[SESSION_ID]).toBeUndefined();
    expect(state.sessionGitlabMr[SESSION_ID]).toBeUndefined();
    expect(state.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
    expect(updateSessionActiveProject).toHaveBeenCalledWith({
      db: tauriDatabase,
      id: SESSION_ID,
      projectId: PROJECT_ID,
    });
  });
});
