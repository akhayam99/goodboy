import { describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';

const { updateSessionActiveProject, tauriDatabase } = vi.hoisted(() => ({
  updateSessionActiveProject: vi.fn(async () => undefined),
  tauriDatabase: {},
}));

vi.mock('@goodboy/db', () => ({ updateSessionActiveProject }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase }));

import { setSessionActiveProject } from './setSessionActiveProject';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-web' as ProjectId;

const harness = ({ cachedPrs }: { cachedPrs: ReadonlyArray<{ number: number }> }) => {
  const refreshSessionPr = vi.fn(async () => undefined);
  const refreshSessionPrDetail = vi.fn(async () => undefined);
  const state = {
    sessions: [{ id: SESSION_ID }],
    sessionActiveProject: {},
    sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
    sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: cachedPrs } },
    sessionGitlabMr: { [SESSION_ID]: { mr: { iid: 42 } } },
    sessionSelectedPrNumber: { [SESSION_ID]: 42 },
    githubStatus: { available: true },
    refreshSessionPr,
    refreshSessionPrDetail,
  };
  const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  });
  const get = vi.fn(() => state);
  return { state, set, get, refreshSessionPr, refreshSessionPrDetail };
};

describe('setSessionActiveProject', () => {
  it('persists the mount and invalidates integration state from the previous repo', async () => {
    const { state, set, get } = harness({ cachedPrs: [] });

    await setSessionActiveProject({ set: set as never, get: get as never })({
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
    });

    expect(state.sessionActiveProject).toEqual({ [SESSION_ID]: PROJECT_ID });
    expect(state.sessions[0]).toEqual({
      id: SESSION_ID,
      activeProjectId: PROJECT_ID,
    });
    expect(state.sessionGithub[SESSION_ID]).toBeUndefined();
    expect(state.sessionGitlabMr[SESSION_ID]).toBeUndefined();
    expect(state.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
    expect(updateSessionActiveProject).toHaveBeenCalledWith({
      db: tauriDatabase,
      id: SESSION_ID,
      projectId: PROJECT_ID,
    });
  });

  it('seeds the surface from the new project pr cache and refreshes it', async () => {
    const { state, refreshSessionPr, refreshSessionPrDetail, set, get } = harness({
      cachedPrs: [{ number: 7 }],
    });

    await setSessionActiveProject({ set: set as never, get: get as never })({
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
    });
    await Promise.resolve();

    expect(state.sessionGithub[SESSION_ID]?.pr).toEqual({ number: 7 });
    expect(refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      silent: true,
      retries: 1,
    });
    await vi.waitFor(() => {
      expect(refreshSessionPrDetail).toHaveBeenCalledWith(SESSION_ID, { silent: true });
    });
  });

  it('skips the refresh when github is unavailable', async () => {
    const { state, refreshSessionPr, set, get } = harness({ cachedPrs: [] });
    Object.assign(state, { githubStatus: { available: false } });

    await setSessionActiveProject({ set: set as never, get: get as never })({
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
    });

    expect(refreshSessionPr).not.toHaveBeenCalled();
  });
});
