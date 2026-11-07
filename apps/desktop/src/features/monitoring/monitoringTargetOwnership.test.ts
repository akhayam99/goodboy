import { describe, expect, it } from 'vitest';
import type { LedgerRow, PortRow } from '@goodboy/core/monitoring';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { brandedId } from '../history/testing/brandedId';
import { isOnTarget } from './isOnTarget';
import type { MonitoringTarget } from './monitoringTarget';
import { mountContaining } from './mountContaining';
import { ownedMountsOf, type OwnedMount } from './ownedMountsOf';
import { portMountOf } from './portMountOf';

const BRANCH = 'feature/check';
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'w-harborline' });
const NOW = '2026-10-10T09:12:00.000Z';

const projectMountOf = ({
  worktreePath,
}: {
  readonly worktreePath: string;
}): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: 'm-h' }),
  sessionId: brandedId<SessionId>({ value: 's-h' }),
  projectId: brandedId<ProjectId>({ value: 'payments-api' }),
  mountName: 'check',
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: '/mock/repo',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const sessionMountOf = ({
  worktreePath,
}: {
  readonly worktreePath: string | null;
}): SessionMountView => ({
  id: brandedId<MountId>({ value: 'm-u' }),
  sessionId: brandedId<SessionId>({ value: 's-h' }),
  projectId: brandedId<ProjectId>({ value: 'payments-api' }),
  worktreePath,
  lastWorktreePath: null,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'check',
  repoSlug: null,
  repoRoot: '/mock/repo',
  isAttached: false,
  diskState: 'unchecked',
  revision: 1,
  createdAt: brandedId<IsoDateTime>({ value: NOW }),
  updatedAt: brandedId<IsoDateTime>({ value: NOW }),
});

const mountOf = ({
  mountId,
  sessionId,
  projectId,
  worktreePath,
  workspaceId,
}: {
  readonly mountId: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly worktreePath: string;
  readonly workspaceId: string | null;
}): OwnedMount => ({
  mountId,
  sessionId,
  workspaceId,
  projectId,
  worktreePath,
  branch: BRANCH,
  isLive: true,
});

const HARBORLINE = mountOf({
  mountId: 'm-h',
  sessionId: 's-h',
  projectId: 'payments-api',
  worktreePath: '/mock/worktrees/harborline/check',
  workspaceId: 'w-harborline',
});
const NORTHWIND = mountOf({
  mountId: 'm-n',
  sessionId: 's-n',
  projectId: 'notify-relay',
  worktreePath: '/mock/worktrees/northwind/check',
  workspaceId: 'w-northwind',
});
const SAME_WORKSPACE_OTHER_REPO = mountOf({
  mountId: 'm-l',
  sessionId: 's-h',
  projectId: 'ledger-core',
  worktreePath: '/mock/worktrees/harborline/ledger-check',
  workspaceId: 'w-harborline',
});

const TARGET: MonitoringTarget = {
  workspaceId: 'w-harborline',
  projectId: 'payments-api',
  branch: BRANCH,
};

const rowOf = ({ spawnId, worktreePath }: { spawnId: string; worktreePath: string | null }) =>
  ({
    key: spawnId,
    port: 5005,
    address: null,
    pid: 10,
    processName: 'node',
    state: 'listening',
    owner: {
      kind: 'terminal',
      spawnId,
      ledgerKind: 'terminal',
      sessionId: null,
      worktreePath,
      projectId: null,
    },
    projectId: null,
    label: null,
    source: null,
    isWatched: false,
  }) satisfies PortRow;

const ledgerOf = ({
  spawnId,
  sessionId,
  cwd,
}: {
  readonly spawnId: string;
  readonly sessionId: string | null;
  readonly cwd: string | null;
}): LedgerRow => ({
  spawnId,
  kind: 'terminal',
  pid: 10,
  pgid: null,
  sessionId,
  mountPath: null,
  cwd,
  startedAt: 1,
});

describe('the mount that owns a terminal', () => {
  it('is the mount whose worktree contains the recorded cwd', () => {
    const entry = ledgerOf({
      spawnId: 't1',
      sessionId: 's-h',
      cwd: '/mock/worktrees/harborline/check/src',
    });
    const mount = portMountOf({
      row: rowOf({ spawnId: 't1', worktreePath: null }),
      ledgerBySpawn: new Map([['t1', entry]]),
      mounts: [NORTHWIND, HARBORLINE],
    });

    expect(mount).toBe(HARBORLINE);
    expect(isOnTarget({ mount, target: TARGET })).toBe(true);
  });

  it('never matches a mount without a path', () => {
    const unattached = ownedMountsOf({
      sessions: [],
      sessionMounts: { 's-h': [sessionMountOf({ worktreePath: null })] },
      sessionProjectMounts: {},
    });

    expect(unattached).toEqual([]);
    expect(mountContaining({ mounts: [HARBORLINE], sessionId: 's-h', path: null })).toBeNull();
    const entry = ledgerOf({ spawnId: 't2', sessionId: 's-h', cwd: null });
    expect(
      portMountOf({
        row: rowOf({ spawnId: 't2', worktreePath: null }),
        ledgerBySpawn: new Map([['t2', entry]]),
        mounts: [HARBORLINE],
      }),
    ).toBeNull();
  });
});

describe('the same branch name in two workspaces', () => {
  const entryFor = (spawnId: string, cwd: string, sessionId: string): LedgerRow =>
    ledgerOf({ spawnId, sessionId, cwd });
  const ledgerBySpawn = new Map<string, LedgerRow>([
    ['th', entryFor('th', HARBORLINE.worktreePath, 's-h')],
    ['tn', entryFor('tn', NORTHWIND.worktreePath, 's-n')],
    ['tl', entryFor('tl', SAME_WORKSPACE_OTHER_REPO.worktreePath, 's-h')],
  ]);
  const mounts = [HARBORLINE, NORTHWIND, SAME_WORKSPACE_OTHER_REPO];
  const isShown = (spawnId: string): boolean =>
    isOnTarget({
      mount: portMountOf({
        row: rowOf({ spawnId, worktreePath: null }),
        ledgerBySpawn,
        mounts,
      }),
      target: TARGET,
    });

  it('shows only the target workspace and repository', () => {
    expect(isShown('th')).toBe(true);
    expect(isShown('tn')).toBe(false);
    expect(isShown('tl')).toBe(false);
  });
});

describe('ownedMountsOf', () => {
  it('reads hydrated project mounts when no session mount was loaded', () => {
    const mounts = ownedMountsOf({
      sessions: [
        aSession({ id: brandedId<SessionId>({ value: 's-h' }), workspaceId: WORKSPACE_ID }),
      ],
      sessionMounts: {},
      sessionProjectMounts: { 's-h': [projectMountOf({ worktreePath: HARBORLINE.worktreePath })] },
    });

    expect(mounts).toEqual([HARBORLINE]);
  });
});
