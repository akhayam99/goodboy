// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  SessionEvent,
  SessionEventId,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { aProject, aSession, nextProjectId, nextSessionId } from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { aRebaseRun } from '../history/testing/aRebaseRun';
import { brandedId } from '../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import {
  ensure,
  resetWorktreeStatusCache,
  worktreeStatusKey,
} from '../../store/runtime/worktreeStatuses/cache';
import { hasOpenRebaseStopOf } from './hasOpenRebaseStopOf';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger-core' });

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: '/w/ledger-core-rates',
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'hl/feat-rates',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const STOP_EVENT: SessionEvent = {
  id: brandedId<SessionEventId>({ value: 'ev-stop-rates' }),
  sessionId: SESSION_ID,
  kind: 'history_stopped',
  payload: {
    mountId: MOUNT_ID,
    branch: MOUNT.branch,
    origin: 'rebase',
    reason: 'conflict',
    files: ['src/rates.ts'],
    head: 'c0ffee1',
  },
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' }),
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'ledger-core' })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
  });
});

type OpenParams = {
  readonly inProgress: 'rebase' | null;
};

const isOpen = ({ inProgress }: OpenParams): boolean =>
  hasOpenRebaseStopOf({
    state: store.getState(),
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    status: { inProgress },
  });

describe('hasOpenRebaseStopOf', () => {
  it('is open while the history run of the shown branch stopped', () => {
    store.setState({
      historyRuns: {
        [MOUNT_ID]: aRebaseRun({ sessionId: SESSION_ID, mountId: MOUNT_ID, phase: 'stopped' }),
      },
    });
    expect(isOpen({ inProgress: null })).toBe(true);
  });

  it('is open after a restart, from the stop the rebase panel rebuilds out of the events', () => {
    store.setState({ sessionEvents: { [SESSION_ID]: [STOP_EVENT] } });
    expect(isOpen({ inProgress: null })).toBe(true);
  });

  it('is closed once the rebuilt stop is settled', () => {
    store.setState({
      sessionEvents: { [SESSION_ID]: [STOP_EVENT] },
      settledRebaseStops: { [SESSION_ID]: [STOP_EVENT.id] },
    });
    expect(isOpen({ inProgress: null })).toBe(false);
  });

  it('is open while git itself is in the middle of a rebase', () => {
    expect(isOpen({ inProgress: 'rebase' })).toBe(true);
  });

  it('is closed with no run, a finished run and no rebase in progress', () => {
    expect(isOpen({ inProgress: null })).toBe(false);
    store.setState({
      historyRuns: {
        [MOUNT_ID]: aRebaseRun({ sessionId: SESSION_ID, mountId: MOUNT_ID, phase: 'pushed' }),
      },
    });
    expect(isOpen({ inProgress: null })).toBe(false);
  });

  it('is closed with no shown mount', () => {
    expect(
      hasOpenRebaseStopOf({
        state: store.getState(),
        sessionId: SESSION_ID,
        mountId: null,
        status: null,
      }),
    ).toBe(false);
  });
});

const gitStatusOf = ({ inProgress }: OpenParams): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: 'c0ffee1',
  headSubject: 'Round rates half to even',
  upstream: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress,
});

describe('hasOpenRebaseStopOf without a status handed in', () => {
  const readFromGit = async ({ inProgress }: OpenParams): Promise<boolean> => {
    stubStoryInvoke({ worktree_status: () => gitStatusOf({ inProgress }) });
    await ensure({
      key: worktreeStatusKey({ worktreePath: MOUNT.worktreePath, baseBranch: 'main' }),
      worktreePath: MOUNT.worktreePath,
      baseBranch: 'main',
      maxAgeMs: 0,
    });
    return hasOpenRebaseStopOf({
      state: store.getState(),
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  };

  it('is open for a rebase started in a terminal, with no Goodboy run or event', async () => {
    expect(await readFromGit({ inProgress: 'rebase' })).toBe(true);
  });

  it('is closed when git is not rebasing and Goodboy holds no stop', async () => {
    expect(await readFromGit({ inProgress: null })).toBe(false);
  });

  it('answers the same as the page does with the live status handed in', async () => {
    const isOpenFromCache = await readFromGit({ inProgress: 'rebase' });

    expect(isOpenFromCache).toBe(isOpen({ inProgress: 'rebase' }));
  });
});
