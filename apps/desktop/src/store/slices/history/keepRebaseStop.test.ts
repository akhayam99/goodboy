// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  SessionEvent,
  SessionEventId,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession, nextProjectId, nextSessionId } from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { rebaseStopOf } from '../../../features/history/rebaseStopOf';
import { aRebaseRun } from '../../../features/history/testing/aRebaseRun';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const MOUNT_ID = brandedId<MountId>({ value: 'mount-members' });

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'harbor-portal',
  worktreePath: '/w/harbor-portal-members',
  lastWorktreePath: null,
  repoRoot: '/repos/harbor-portal',
  branch: 'hl/feat-center-members-page',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

type StopParams = {
  readonly id: string;
  readonly at: string;
};

const aStop = ({ id, at }: StopParams): SessionEvent => ({
  id: brandedId<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind: 'history_stopped',
  payload: {
    mountId: MOUNT_ID,
    branch: MOUNT.branch,
    origin: 'rebase',
    reason: 'conflict',
    files: ['src/pages/members/MembersPage.tsx'],
    head: 'b0a1c2d',
  },
  createdAt: brandedId<IsoDateTime>({ value: at }),
});

const OLD_STOP = aStop({ id: 'ev-stop-1', at: '2026-10-01T10:00:00.000Z' });

const CONFLICT_RUN = aRebaseRun({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  phase: 'stopped',
  stop: {
    reason: 'conflict',
    message: '1 file conflicts with main.',
    files: ['src/pages/members/MembersPage.tsx'],
    sha: null,
    head: 'b0a1c2d',
  },
  rebaseConflict: {
    ontoRef: 'origin/main',
    baseBranch: 'main',
    head: 'b0a1c2d',
    autoAgentId: null,
  },
});

let store: StoryStore;

const writes: Array<string> = [];

type WriteParams = {
  readonly onWrite?: () => void;
};

const saves = ({ onWrite }: WriteParams = {}): void => {
  stubStoryInvoke({
    db_execute: () => {
      writes.push('session_events');
      onWrite?.();
      return { rowsAffected: 1, lastInsertId: 0 };
    },
  });
};

const failsOnce = (): void => {
  stubStoryInvoke({
    db_execute: () => {
      saves();
      throw new Error('database is locked');
    },
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  writes.length = 0;
  saves();
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'harbor-portal' })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
  });
});

const stopNow = () =>
  rebaseStopOf({
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    run: store.getState().historyRuns[MOUNT_ID],
    events: store.getState().sessionEvents[SESSION_ID],
    settledStopIds: undefined,
    baseBranch: 'main',
    read: null,
  });

const kept = (): ReadonlyArray<SessionEvent> =>
  (store.getState().sessionEvents[SESSION_ID] ?? []).filter(
    (event) => event.kind === 'history_restored' && event.payload?.reason === 'kept',
  );

describe('keep branch as it was', () => {
  it('records the kept event, drops the run, and the stop is gone in this window', async () => {
    store.setState({
      historyRuns: { [MOUNT_ID]: CONFLICT_RUN },
      sessionEvents: { [SESSION_ID]: [OLD_STOP] },
    });

    await store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(writes).toEqual(['session_events']);
    expect(kept()).toHaveLength(1);
    expect(kept()[0]?.payload).toMatchObject({
      mountId: MOUNT_ID,
      origin: 'rebase',
      branch: 'hl/feat-center-members-page',
    });
    expect(store.getState().historyRuns[MOUNT_ID]).toBeUndefined();
    expect(stopNow()).toBeNull();
  });

  it('keeps a stop rebuilt from the saved record in a window that never ran it', async () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [OLD_STOP] } });
    expect(stopNow()?.isRebuilt).toBe(true);

    await store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(stopNow()).toBeNull();
  });

  it('changes nothing when the record cannot be saved, so Retry can try again', async () => {
    failsOnce();
    store.setState({
      historyRuns: { [MOUNT_ID]: CONFLICT_RUN },
      sessionEvents: { [SESSION_ID]: [OLD_STOP] },
    });

    await expect(
      store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('database is locked');
    expect(store.getState().historyRuns[MOUNT_ID]).toBe(CONFLICT_RUN);
    expect(kept()).toHaveLength(0);

    await store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(stopNow()).toBeNull();
  });

  it('never drops a new rebase that started while the record was being saved', async () => {
    const newer = aRebaseRun({ sessionId: SESSION_ID, mountId: MOUNT_ID, phase: 'trying' });
    saves({ onWrite: () => store.setState({ historyRuns: { [MOUNT_ID]: newer } }) });
    store.setState({
      historyRuns: { [MOUNT_ID]: CONFLICT_RUN },
      sessionEvents: { [SESSION_ID]: [OLD_STOP] },
    });

    await store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(store.getState().historyRuns[MOUNT_ID]).toBe(newer);
  });

  it('brings the branch back as a new stop when a later rebase stops again', async () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [OLD_STOP] } });
    await store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(stopNow()).toBeNull();

    const next = aStop({ id: 'ev-stop-2', at: new Date(Date.now() + 1_000).toISOString() });
    store.setState((state) => ({
      sessionEvents: {
        [SESSION_ID]: [...(state.sessionEvents[SESSION_ID] ?? []), next],
      },
    }));

    expect(stopNow()?.eventId).toBe(next.id);
  });

  it('throws without writing when the branch left the session', async () => {
    store.setState({ sessionProjectMounts: { [SESSION_ID]: [] } });

    await expect(
      store.getState().keepRebaseStop({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow('This branch is no longer in the session.');
    expect(writes).toEqual([]);
  });
});
