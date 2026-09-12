import { describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';

const { updateSessionWriteDestination, tauriDatabase } = vi.hoisted(() => ({
  updateSessionWriteDestination: vi.fn(async () => true),
  tauriDatabase: {},
}));

vi.mock('@goodboy/db', () => ({ updateSessionWriteDestination }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase }));

import { setSessionActiveMount } from './setSessionActiveMount';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-web' as ProjectId;
const FIRST_MOUNT = 'mount-1' as MountId;
const SECOND_MOUNT = 'mount-2' as MountId;

const mount = ({ mountId, branch }: { readonly mountId: MountId; readonly branch: string }) => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'web',
  worktreePath: `/sessions/one/${mountId}`,
  repoRoot: '/repo/web',
  branch,
  isAttached: true,
  diskState: 'present' as const,
});

const harness = ({ cachedPrs }: { readonly cachedPrs: ReadonlyArray<{ number: number }> }) => {
  const refreshSessionPr = vi.fn(async () => undefined);
  const refreshSessionPrDetail = vi.fn(async () => undefined);
  const recordSessionEvent = vi.fn(async () => undefined);
  const state = {
    projects: [{ id: PROJECT_ID, name: 'app-web' }],
    recordSessionEvent,
    sessions: [{ id: SESSION_ID, activeMountId: FIRST_MOUNT }],
    sessionMounts: {},
    sessionActiveMount: { [SESSION_ID]: FIRST_MOUNT },
    sessionActiveProject: {},
    sessionBranches: { [SESSION_ID]: 'ak/one' },
    sessionProjectMounts: {
      [SESSION_ID]: [
        mount({ mountId: FIRST_MOUNT, branch: 'ak/one' }),
        mount({ mountId: SECOND_MOUNT, branch: 'ak/two' }),
      ],
    },
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
  return { state, set, get, refreshSessionPr, recordSessionEvent };
};

describe('setSessionActiveMount', () => {
  it('selects the named mount and reads its branch', async () => {
    const { state, set, get } = harness({ cachedPrs: [] });

    await setSessionActiveMount(
      set as never,
      get as never,
    )({
      sessionId: SESSION_ID,
      mountId: SECOND_MOUNT,
    });

    expect(state.sessionActiveMount[SESSION_ID]).toBe(SECOND_MOUNT);
    expect(state.sessionBranches[SESSION_ID]).toBe('ak/two');
    expect(updateSessionWriteDestination).toHaveBeenCalledWith({
      db: tauriDatabase,
      sessionId: SESSION_ID,
      mountId: SECOND_MOUNT,
    });
  });

  it('drops the integration state the previous mount owned', async () => {
    const { state, set, get } = harness({ cachedPrs: [] });

    await setSessionActiveMount(
      set as never,
      get as never,
    )({
      sessionId: SESSION_ID,
      mountId: SECOND_MOUNT,
    });

    expect(state.sessionGithub[SESSION_ID]).toBeUndefined();
    expect(state.sessionGitlabMr[SESSION_ID]).toBeUndefined();
    expect(state.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
  });

  it('refuses a mount that is not available in the session', async () => {
    const { state, set, get } = harness({ cachedPrs: [] });

    await expect(
      setSessionActiveMount(
        set as never,
        get as never,
      )({
        sessionId: SESSION_ID,
        mountId: 'mount-missing' as MountId,
      }),
    ).rejects.toThrow(/not available/);
    expect(state.sessionActiveMount[SESSION_ID]).toBe(FIRST_MOUNT);
  });

  it('records the new write destination on the session timeline', async () => {
    const { set, get, recordSessionEvent } = harness({ cachedPrs: [] });

    await setSessionActiveMount(
      set as never,
      get as never,
    )({ sessionId: SESSION_ID, mountId: SECOND_MOUNT });

    expect(recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'write_destination_changed',
      payload: {
        mountId: SECOND_MOUNT,
        projectId: PROJECT_ID,
        projectName: 'app-web',
        branch: 'ak/two',
      },
    });
  });

  it('records nothing when the destination already was the chosen mount', async () => {
    const { set, get, recordSessionEvent } = harness({ cachedPrs: [] });

    await setSessionActiveMount(
      set as never,
      get as never,
    )({ sessionId: SESSION_ID, mountId: FIRST_MOUNT });

    expect(recordSessionEvent).not.toHaveBeenCalled();
  });
});
