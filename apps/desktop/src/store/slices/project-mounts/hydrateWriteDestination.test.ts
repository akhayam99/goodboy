import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { hydrateWriteDestination } from './hydrateWriteDestination';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_A = 'project-a' as ProjectId;
const PROJECT_B = 'project-b' as ProjectId;
const FIRST = 'mount-a-1' as MountId;
const SECOND = 'mount-a-2' as MountId;
const THIRD = 'mount-b-1' as MountId;

const mount = ({
  mountId,
  projectId,
  branch,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
}): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: 'app',
  worktreePath: `/sessions/one/${mountId}`,
  lastWorktreePath: null,
  repoRoot: '/repos/app',
  branch,
  baseBranch: 'main',
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const SIBLINGS: ReadonlyArray<SessionProjectMount> = [
  mount({ mountId: FIRST, projectId: PROJECT_A, branch: 'ak/one' }),
  mount({ mountId: SECOND, projectId: PROJECT_A, branch: 'ak/two' }),
  mount({ mountId: THIRD, projectId: PROJECT_B, branch: 'ak/three' }),
];

describe('hydrateWriteDestination', () => {
  it('restores the persisted mount, sibling or not', () => {
    expect(hydrateWriteDestination({ mounts: SIBLINGS, storedMountId: SECOND })).toEqual({
      kind: 'restored',
      mountId: SECOND,
      projectId: PROJECT_A,
      branch: 'ak/two',
    });
  });

  it('repairs a session that holds one mount and never chose it', () => {
    expect(
      hydrateWriteDestination({
        mounts: [SIBLINGS[0] as SessionProjectMount],
        storedMountId: null,
      }),
    ).toEqual({
      kind: 'repaired',
      mountId: FIRST,
      projectId: PROJECT_A,
      branch: 'ak/one',
    });
  });

  it('leaves a session with several mounts and no choice unselected', () => {
    expect(hydrateWriteDestination({ mounts: SIBLINGS, storedMountId: null })).toEqual({
      kind: 'unselected',
    });
  });

  it('refuses to degrade to the scratch folder when the persisted mount is gone', () => {
    expect(
      hydrateWriteDestination({ mounts: SIBLINGS, storedMountId: 'mount-gone' as MountId }),
    ).toEqual({ kind: 'unselected' });
  });

  it('falls back to the scratch folder only when the session holds no mount', () => {
    expect(hydrateWriteDestination({ mounts: [], storedMountId: FIRST })).toEqual({
      kind: 'scratch',
    });
  });
});
