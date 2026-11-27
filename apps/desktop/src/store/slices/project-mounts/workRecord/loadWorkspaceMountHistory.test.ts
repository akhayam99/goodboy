// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type MountId,
  type MountPullRequestLink,
  type SessionId,
  type SessionMount,
} from '@goodboy/types';
import { at, paymentsApi } from '../../../../features/workspace/testing/sessionColumn';

vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());

import * as db from '@goodboy/db';
import { storySpies } from '../../../storyHarness';
import {
  loadWorkspaceMountHistory,
  mountHistoryPatchOf,
  reseededMountsOf,
} from './loadWorkspaceMountHistory';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT = paymentsApi.id;
const GONE = brandId<MountId>({ value: 'mount-gone' });
const ORPHAN = brandId<MountId>({ value: 'mount-orphan' });
const DATE = at('2026-10-07T09:00:00.000Z');

const projects = [paymentsApi];

type MountParams = {
  readonly id: MountId;
  readonly projectId: typeof PROJECT | null;
};

const mountOf = ({ id, projectId }: MountParams): SessionMount => ({
  id,
  sessionId: SESSION,
  projectId,
  worktreePath: null,
  lastWorktreePath: `/tmp/payments-api/${id}`,
  branch: `harborline/${id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: null,
  repoSlug: null,
  isAttached: false,
  diskState: 'removed',
  revision: 1,
  createdAt: DATE,
  updatedAt: DATE,
});

const linkOf = ({ id }: { readonly id: MountId }): MountPullRequestLink => ({
  id: `link-${id}`,
  mountId: id,
  provider: 'github',
  host: 'github.com',
  repoSlug: 'harborline/payments-api',
  prNumber: 41,
  headBranch: `harborline/${id}`,
  baseBranch: 'main',
  url: 'https://github.com/harborline/payments-api/pull/41',
  state: 'merged',
  snapshot: null,
  mergedAt: DATE,
  lastObservedAt: DATE,
  createdAt: DATE,
  updatedAt: DATE,
});

describe('loadWorkspaceMountHistory', () => {
  it('keeps the removed mounts of a session with their project and their stored request', async () => {
    storySpies.listSessionMounts.mockResolvedValue([
      mountOf({ id: GONE, projectId: PROJECT }),
      mountOf({ id: ORPHAN, projectId: null }),
    ]);
    vi.mocked(db.listMountPullRequestLinks).mockResolvedValue([linkOf({ id: GONE })]);

    const history = await loadWorkspaceMountHistory({ projects, sessionIds: [SESSION] });

    expect(history.removed[SESSION]?.map((view) => [view.id, view.mountName])).toEqual([
      [GONE, 'payments-api'],
    ]);
    expect(history.removed[SESSION]?.[0]?.repoRoot).toBe(paymentsApi.rootPath);
    expect(history.mountPrLinks[GONE]?.prNumber).toBe(41);
  });

  it('is empty when no mount was removed', async () => {
    storySpies.listSessionMounts.mockResolvedValue([]);
    vi.mocked(db.listMountPullRequestLinks).mockResolvedValue([]);

    expect(await loadWorkspaceMountHistory({ projects, sessionIds: [SESSION] })).toEqual({
      removed: {},
      mountPrLinks: {},
    });
  });

  it('seeds a session with its attached mounts and its removed ones, and no other session', async () => {
    storySpies.listSessionMounts.mockResolvedValue([mountOf({ id: GONE, projectId: PROJECT })]);
    vi.mocked(db.listMountPullRequestLinks).mockResolvedValue([linkOf({ id: GONE })]);
    const history = await loadWorkspaceMountHistory({ projects, sessionIds: [SESSION] });
    const attached = {
      mountId: brandId<MountId>({ value: 'mount-live' }),
      sessionId: SESSION,
      projectId: PROJECT,
      mountName: 'payments-api',
      worktreePath: '/tmp/payments-api/live',
      lastWorktreePath: null,
      repoRoot: paymentsApi.rootPath,
      branch: 'harborline/live',
      baseBranch: 'main',
      parallelIndex: 1,
      isAttached: true as const,
      diskState: 'present' as const,
      revision: 1,
    };
    const state = { sessionMounts: {}, mountPrLinks: {} };

    const patch = mountHistoryPatchOf({ state, mounts: { [SESSION]: [attached] }, history });

    expect(patch.sessionMounts[SESSION]?.map((view) => view.id)).toEqual(['mount-live', GONE]);
    expect(patch.mountPrLinks[GONE]?.state).toBe('merged');
    expect(
      reseededMountsOf({ state: patch, mounts: { [SESSION]: [] }, sessionIds: [SESSION] })[
        SESSION
      ]?.map((view) => view.id),
    ).toEqual([GONE]);
  });
});
