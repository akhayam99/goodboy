// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { overlapCautionOf } from './overlapCautionOf';
import { overlapGroupOf } from './overlapGroupOf';
import type { LiveMount } from './readLiveMounts';

const mountOf = (id: string, paths: ReadonlyArray<string>, createdAt: number): LiveMount => ({
  mountId: brandId<MountId>({ value: id }),
  sessionId: brandId<SessionId>({ value: 'session-1' }),
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  branch: `nw/${id}`,
  createdAt,
  port: null,
  hasFixedPort: false,
  paths,
});

const OWN = mountOf('own', ['a.ts', 'b.ts', 'c.ts'], 2);
const OTHER = mountOf('other', ['a.ts', 'b.ts', 'c.ts', 'd.ts'], 1);
const GROUP = overlapGroupOf({ mounts: [OWN, OTHER], mountId: 'own' });

describe('overlapCautionOf', () => {
  it('names the first ready branch and the files they share', () => {
    expect(
      overlapCautionOf({ group: GROUP, readyMountIds: new Set(['other']), isSettled: false }),
    ).toEqual({ fileCount: 3, otherMountId: 'other', otherBranch: 'nw/other' });
  });

  it('stays quiet while no other branch is ready', () => {
    expect(
      overlapCautionOf({ group: GROUP, readyMountIds: new Set(), isSettled: false }),
    ).toBeNull();
  });

  it('says nothing about a settled branch or without an overlap', () => {
    expect(
      overlapCautionOf({ group: GROUP, readyMountIds: new Set(['other']), isSettled: true }),
    ).toBeNull();
    expect(
      overlapCautionOf({ group: null, readyMountIds: new Set(['other']), isSettled: false }),
    ).toBeNull();
  });

  it('ignores a ready answer for a branch outside the group', () => {
    expect(
      overlapCautionOf({ group: GROUP, readyMountIds: new Set(['stale']), isSettled: false }),
    ).toBeNull();
  });
});
