import { describe, expect, it } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import {
  ARTIFACT_MOUNT_CAP,
  artifactMountOptionsKey,
  defaultArtifactMountIds,
  resolveArtifactMounts,
  selectArtifactMountOptions,
  selectDefaultArtifactMountIds,
  toggleArtifactMountId,
  type ArtifactMountOption,
} from './artifactMountChoice';

const SESSION_ID = 'session-1' as SessionId;

const mountRow = ({
  mountId,
  mountName,
  worktreePath = `/tmp/${mountId}`,
}: {
  readonly mountId: string;
  readonly mountName: string;
  readonly worktreePath?: string;
}) => ({
  mountId: mountId as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-1',
  mountName,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: `/repo/${mountId}`,
  branch: `ak/${mountName}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const stateWith = (
  mounts: ReadonlyArray<ReturnType<typeof mountRow>>,
  selected: string | null = null,
): AppState =>
  ({
    sessions: [{ id: SESSION_ID }],
    sessionMounts: {},
    sessionProjectMounts: { [SESSION_ID]: mounts },
    sessionActiveMount: selected === null ? {} : { [SESSION_ID]: selected },
  }) as unknown as AppState;

const option = (mountId: string): ArtifactMountOption => ({
  mountId: mountId as MountId,
  mountName: mountId,
  branch: 'main',
  baseBranch: 'main',
  worktreePath: `/tmp/${mountId}`,
});

describe('selectArtifactMountOptions', () => {
  it('drops a mount with no worktree on disk', () => {
    const state = stateWith([
      mountRow({ mountId: 'mount-web', mountName: 'web' }),
      mountRow({ mountId: 'mount-gone', mountName: 'gone', worktreePath: '' }),
    ]);
    expect(
      selectArtifactMountOptions({ state, sessionId: SESSION_ID }).map((entry) => entry.mountId),
    ).toEqual(['mount-web']);
  });

  it('keys the options by what the row shows', () => {
    const state = stateWith([mountRow({ mountId: 'mount-web', mountName: 'web' })]);
    expect(artifactMountOptionsKey({ state, sessionId: SESSION_ID })).toBe('mount-web:web:ak/web');
  });
});

describe('defaultArtifactMountIds', () => {
  it('chooses nothing when nothing is mounted', () => {
    expect(defaultArtifactMountIds({ options: [], selectedMountId: null })).toEqual([]);
  });

  it('chooses the sole mount', () => {
    expect(
      defaultArtifactMountIds({ options: [option('mount-web')], selectedMountId: null }),
    ).toEqual(['mount-web']);
  });

  it('chooses the sole mount even when another one is selected', () => {
    expect(
      defaultArtifactMountIds({
        options: [option('mount-web')],
        selectedMountId: 'mount-api' as MountId,
      }),
    ).toEqual(['mount-web']);
  });

  it('chooses the selected mount when several are attached', () => {
    expect(
      defaultArtifactMountIds({
        options: [option('mount-web'), option('mount-api')],
        selectedMountId: 'mount-api' as MountId,
      }),
    ).toEqual(['mount-api']);
  });

  it('chooses them all when several are attached and none is selected', () => {
    expect(
      defaultArtifactMountIds({
        options: [option('mount-web'), option('mount-api')],
        selectedMountId: null,
      }),
    ).toEqual(['mount-web', 'mount-api']);
  });

  it('never chooses more than a run can read', () => {
    const options = Array.from({ length: ARTIFACT_MOUNT_CAP + 3 }, (_, index) =>
      option(`mount-${index}`),
    );
    expect(defaultArtifactMountIds({ options, selectedMountId: null })).toHaveLength(
      ARTIFACT_MOUNT_CAP,
    );
  });

  it('reads the selection out of the session state', () => {
    const state = stateWith(
      [
        mountRow({ mountId: 'mount-web', mountName: 'web' }),
        mountRow({ mountId: 'mount-api', mountName: 'api' }),
      ],
      'mount-api',
    );
    expect(selectDefaultArtifactMountIds({ state, sessionId: SESSION_ID })).toEqual(['mount-api']);
  });
});

describe('toggleArtifactMountId', () => {
  it('adds and removes a mount', () => {
    const added = toggleArtifactMountId({
      mountIds: ['mount-web' as MountId],
      mountId: 'mount-api' as MountId,
    });
    expect(added).toEqual(['mount-web', 'mount-api']);
    expect(toggleArtifactMountId({ mountIds: added, mountId: 'mount-web' as MountId })).toEqual([
      'mount-api',
    ]);
  });

  it('refuses one past the cap instead of silently dropping another', () => {
    const full = Array.from(
      { length: ARTIFACT_MOUNT_CAP },
      (_, index) => `mount-${index}` as MountId,
    );
    expect(toggleArtifactMountId({ mountIds: full, mountId: 'mount-extra' as MountId })).toEqual(
      full,
    );
  });
});

describe('resolveArtifactMounts', () => {
  const state = stateWith([
    mountRow({ mountId: 'mount-web', mountName: 'web' }),
    mountRow({ mountId: 'mount-api', mountName: 'api' }),
  ]);

  it('resolves the chosen ids in the order the user chose them', () => {
    expect(
      resolveArtifactMounts({
        state,
        sessionId: SESSION_ID,
        mountIds: ['mount-api' as MountId, 'mount-web' as MountId],
      }).map((entry) => entry.mountId),
    ).toEqual(['mount-api', 'mount-web']);
  });

  it('caps the chosen ids from the end the user chose last', () => {
    const many = stateWith(
      Array.from({ length: ARTIFACT_MOUNT_CAP + 1 }, (_, index) =>
        mountRow({ mountId: `mount-${index}`, mountName: `name-${index}` }),
      ),
    );
    const chosen = Array.from(
      { length: ARTIFACT_MOUNT_CAP + 1 },
      (_, index) => `mount-${ARTIFACT_MOUNT_CAP - index}` as MountId,
    );
    expect(
      resolveArtifactMounts({ state: many, sessionId: SESSION_ID, mountIds: chosen }).map(
        (entry) => entry.mountId,
      ),
    ).toEqual(chosen.slice(0, ARTIFACT_MOUNT_CAP));
  });

  it('resolves nothing when nothing was chosen', () => {
    expect(resolveArtifactMounts({ state, sessionId: SESSION_ID, mountIds: [] })).toEqual([]);
  });

  it('forgets an id whose mount is gone', () => {
    expect(
      resolveArtifactMounts({
        state,
        sessionId: SESSION_ID,
        mountIds: ['mount-web' as MountId, 'mount-detached' as MountId],
      }).map((entry) => entry.mountId),
    ).toEqual(['mount-web']);
  });
});
