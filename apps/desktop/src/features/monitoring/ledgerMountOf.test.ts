import { describe, expect, it } from 'vitest';
import type { LedgerRow, PortRow } from '@goodboy/core/monitoring';
import { isOnTarget } from './isOnTarget';
import { ledgerMountOf } from './ledgerMountOf';
import type { MonitoringTarget } from './monitoringTarget';
import type { OwnedMount } from './ownedMountsOf';
import { portMountOf } from './portMountOf';
import { startedByGoodboy } from './startedByGoodboy';

const STARTED_ON = 'nw/fix-duplicate-credit';
const SWITCHED_TO = 'nw/ledger-rounding';
const WORKTREE = '/mock/worktrees/northwind/payments-api';

const MOUNT_NOW: OwnedMount = {
  mountId: 'm-payments',
  sessionId: 's-northwind',
  workspaceId: 'w-northwind',
  projectId: 'payments-api',
  worktreePath: WORKTREE,
  branch: SWITCHED_TO,
  isLive: true,
};

const LEDGER: LedgerRow = {
  spawnId: 'spawn-dev',
  kind: 'terminal',
  pid: 4100,
  pgid: 4100,
  sessionId: 's-northwind',
  mountPath: null,
  cwd: `${WORKTREE}/web`,
  startedAt: 1,
  branch: STARTED_ON,
};

const PORT: PortRow = {
  key: '5173:4100',
  port: 5173,
  address: '127.0.0.1',
  pid: 4100,
  processName: 'node',
  state: 'listening',
  owner: {
    kind: 'terminal',
    spawnId: 'spawn-dev',
    ledgerKind: 'terminal',
    sessionId: 's-northwind',
    worktreePath: WORKTREE,
    projectId: 'payments-api',
  },
  projectId: 'payments-api',
  label: 'web',
  source: 'vite',
  isWatched: true,
};

type TargetParams = {
  readonly branch: string;
};

const targetOn = ({ branch }: TargetParams): MonitoringTarget => ({
  workspaceId: 'w-northwind',
  projectId: 'payments-api',
  branch,
});

describe('a process keeps the branch it started on', () => {
  it('stays on its spawn branch after the worktree switches', () => {
    const mount = portMountOf({
      row: PORT,
      ledgerBySpawn: new Map([[LEDGER.spawnId, LEDGER]]),
      mounts: [MOUNT_NOW],
    });
    expect(mount?.branch).toBe(STARTED_ON);
    expect(isOnTarget({ mount, target: targetOn({ branch: STARTED_ON }) })).toBe(true);
    expect(isOnTarget({ mount, target: targetOn({ branch: SWITCHED_TO }) })).toBe(false);
  });

  it('lists a portless process under its spawn branch too', () => {
    const [row] = startedByGoodboy({
      snapshot: {
        listeners: [],
        processes: [
          {
            pid: 4100,
            ppid: 1,
            pgid: 4100,
            name: 'node',
            cwd: WORKTREE,
            startedAt: 1,
            cpuPercent: 0,
            rssBytes: 0,
            uid: 501,
            argsMasked: 'node vite',
          },
        ],
        takenAt: 2,
        isPlatformSupported: true,
      },
      ledger: [LEDGER],
      projects: [],
      mounts: [MOUNT_NOW],
    });
    expect(row?.mount?.branch).toBe(STARTED_ON);
  });

  it('follows the mount when the ledger has no branch', () => {
    const mount = ledgerMountOf({
      entry: { mountId: null, branch: null },
      mounts: [MOUNT_NOW],
      sessionId: 's-northwind',
      path: WORKTREE,
    });
    expect(mount).toBe(MOUNT_NOW);
  });

  it('finds the mount by its recorded identity before its path', () => {
    const other: OwnedMount = { ...MOUNT_NOW, mountId: 'm-other', worktreePath: '/mock/elsewhere' };
    const mount = ledgerMountOf({
      entry: { mountId: 'm-other', branch: STARTED_ON },
      mounts: [MOUNT_NOW, other],
      sessionId: 's-northwind',
      path: WORKTREE,
    });
    expect(mount?.mountId).toBe('m-other');
    expect(mount?.branch).toBe(STARTED_ON);
  });

  describe('a mount that moved', () => {
    const MOVED: OwnedMount = {
      ...MOUNT_NOW,
      worktreePath: '/mock/worktrees/northwind/payments-api-moved',
      branch: 'nw/fix-double-credit',
    };

    it('wins over a branch the ledger read at its old place', () => {
      const mount = ledgerMountOf({
        entry: { mountId: MOVED.mountId, branch: STARTED_ON, branchPath: WORKTREE },
        mounts: [MOVED],
        sessionId: 's-northwind',
        path: WORKTREE,
      });
      expect(mount).toBe(MOVED);
    });

    it('keeps the spawn branch the ledger confirmed at its new place', () => {
      const mount = ledgerMountOf({
        entry: { mountId: MOVED.mountId, branch: STARTED_ON, branchPath: MOVED.worktreePath },
        mounts: [MOVED],
        sessionId: 's-northwind',
        path: WORKTREE,
      });
      expect(mount?.worktreePath).toBe(MOVED.worktreePath);
      expect(mount?.branch).toBe(STARTED_ON);
    });

    it('keeps the recorded branch when the ledger could not confirm it anywhere', () => {
      const mount = ledgerMountOf({
        entry: { mountId: MOVED.mountId, branch: STARTED_ON, branchPath: null },
        mounts: [MOVED],
        sessionId: 's-northwind',
        path: WORKTREE,
      });
      expect(mount?.branch).toBe(STARTED_ON);
    });
  });
});
