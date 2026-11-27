// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import type { MountRequestView } from '../../store/slices/project-mounts/mountRowModel';
import { isReadyToLand, overlapCautionOf } from './overlapCautionOf';
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

type RequestParams = Partial<
  Pick<MountRequestView, 'state' | 'isDraft' | 'checks' | 'reviewDecision'>
>;

const requestOf = ({
  state = 'open',
  isDraft = false,
  checks = null,
  reviewDecision = null,
}: RequestParams): MountRequestView => ({
  provider: 'github',
  identity: null,
  number: 12,
  state,
  isDraft,
  checks,
  reviewDecision,
  url: '',
  title: '',
  label: 'PR #12',
});

describe('overlapCautionOf', () => {
  it('cautions when the other branch is ready, approved or queued', () => {
    expect(isReadyToLand({ request: requestOf({ checks: 'success' }) })).toBe(true);
    expect(isReadyToLand({ request: requestOf({ reviewDecision: 'approved' }) })).toBe(true);
    expect(isReadyToLand({ request: requestOf({ state: 'queued' }) })).toBe(true);
    expect(
      overlapCautionOf({ group: GROUP, readyMountIds: new Set(['other']), isSettled: false }),
    ).toEqual({ fileCount: 3, otherMountId: 'other', otherBranch: 'nw/other' });
  });

  it('stays quiet while the other branch is a draft, failing, merged or has no request', () => {
    expect(isReadyToLand({ request: requestOf({ isDraft: true, checks: 'success' }) })).toBe(false);
    expect(isReadyToLand({ request: requestOf({ checks: 'failure' }) })).toBe(false);
    expect(isReadyToLand({ request: requestOf({ state: 'merged', checks: 'success' }) })).toBe(
      false,
    );
    expect(isReadyToLand({ request: null })).toBe(false);
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
