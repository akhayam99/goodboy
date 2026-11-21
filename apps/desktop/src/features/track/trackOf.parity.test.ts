// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountDiskState,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import { applyMountViews } from '../../store/slices/project-mounts/mountViews';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { trackOf } from './trackOf';

const S1 = brandId<SessionId>({ value: 'session-harborline-export' });
const S2 = brandId<SessionId>({ value: 'session-northwind-retries' });
const AT = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

type ViewParams = {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly worktreePath?: string | null;
  readonly isAttached?: boolean;
  readonly diskState?: MountDiskState;
};

const viewOf = ({
  sessionId,
  name,
  worktreePath = `/work/${name}`,
  isAttached = true,
  diskState = 'present',
}: ViewParams): SessionMountView => ({
  id: brandId<MountId>({ value: `mount-${sessionId}-${name}` }),
  sessionId,
  projectId: brandId<ProjectId>({ value: `project-${name}` }),
  worktreePath,
  lastWorktreePath: worktreePath,
  branch: `hl/${name}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: name,
  repoSlug: `acme/${name}`,
  isAttached,
  diskState,
  revision: 3,
  createdAt: AT,
  updatedAt: AT,
  repoRoot: `/repos/${name}`,
});

const S1_VIEWS = [
  viewOf({ sessionId: S1, name: 'ledger-core' }),
  viewOf({ sessionId: S1, name: 'payments-api', diskState: 'missing' }),
  viewOf({ sessionId: S1, name: 'notify-relay', isAttached: false }),
  viewOf({ sessionId: S1, name: 'cascadia-docs', worktreePath: null }),
];

const S2_VIEWS = [viewOf({ sessionId: S2, name: 'ledger-core' })];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const active = S1_VIEWS[1];
  useAppStore.setState({
    sessionActiveMount: { [S1]: active === undefined ? null : active.id },
  });
  applyMountViews({ set: useAppStore.setState, sessionId: S1, views: S1_VIEWS });
  applyMountViews({ set: useAppStore.setState, sessionId: S2, views: S2_VIEWS });
});

type SessionParams = {
  readonly sessionId: SessionId;
};

const tracksOf = ({ sessionId }: SessionParams) => {
  const state = useAppStore.getState();
  return (state.sessionMounts[sessionId] ?? []).flatMap((view) => {
    const track = trackOf({ state, sessionId, mountId: view.id });
    return track === null ? [] : [track];
  });
};

describe('trackOf against the five mount shapes of a session', () => {
  it.each([
    ['three mounts, one active', S1],
    ['one mount, none chosen', S2],
  ])('says the same as sessionMounts and sessionProjectMounts (%s)', (_name, sessionId) => {
    const state = useAppStore.getState();
    const views = state.sessionMounts[sessionId] ?? [];

    for (const view of views) {
      const track = trackOf({ state, sessionId, mountId: view.id });
      expect(track !== null).toBe(view.isAttached && view.worktreePath !== null);
      expect(track?.mount.branch ?? view.branch).toBe(view.branch);
      expect(track?.mount.worktreePath ?? view.worktreePath).toBe(view.worktreePath);
      expect(track?.mount.revision ?? view.revision).toBe(view.revision);
    }
    expect(tracksOf({ sessionId }).map((track) => track.mount.mountId)).toEqual(
      (state.sessionProjectMounts[sessionId] ?? []).map((mount) => mount.mountId),
    );
  });

  it.each([S1, S2])('says the same as sessionWorktrees for %s', (sessionId) => {
    expect(tracksOf({ sessionId }).map((track) => track.mount.worktreePath)).toEqual(
      useAppStore.getState().sessionWorktrees[sessionId],
    );
  });

  it.each([S1, S2])('says the same as sessionWorktreeRecords for %s', (sessionId) => {
    const onDisk = tracksOf({ sessionId }).filter(
      (track) => track.mount.diskState !== 'missing' && track.mount.diskState !== 'removed',
    );
    const records = useAppStore.getState().sessionWorktreeRecords?.[sessionId] ?? [];

    expect(records.map((record) => record.id)).toEqual(onDisk.map((track) => track.mount.mountId));
    expect(records.map((record) => [record.worktreePath, record.branch])).toEqual(
      onDisk.map((track) => [track.mount.worktreePath, track.mount.branch]),
    );
  });

  it('says the same as sessionBranches for the chosen mount, and nothing when none is chosen', () => {
    const state = useAppStore.getState();
    const chosen = state.sessionActiveMount[S1] ?? null;
    const track = chosen === null ? null : trackOf({ state, sessionId: S1, mountId: chosen });

    expect(state.sessionBranches[S1]).toBe(track?.mount.branch);
    expect(state.sessionBranches[S2]).toBeUndefined();
  });

  it('keeps each track in its own session', () => {
    const state = useAppStore.getState();
    const other = S2_VIEWS[0];

    expect(
      other === undefined ? null : trackOf({ state, sessionId: S1, mountId: other.id }),
    ).toBeNull();
    expect(tracksOf({ sessionId: S2 }).map((track) => track.mount.sessionId)).toEqual([S2]);
  });
});
