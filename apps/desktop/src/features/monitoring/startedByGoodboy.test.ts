import { describe, expect, it } from 'vitest';
import type { LedgerRow, MonitorSnapshot } from '@goodboy/core/monitoring';
import { isOnTarget } from './isOnTarget';
import type { MonitoringTarget } from './monitoringTarget';
import type { OwnedMount } from './ownedMountsOf';
import { startedByGoodboy } from './startedByGoodboy';

const BRANCH = 'feature/check';

const mountOf = ({
  mountId,
  sessionId,
  workspaceId,
  projectId,
  worktreePath,
}: {
  readonly mountId: string;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly worktreePath: string;
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
  workspaceId: 'w-harborline',
  projectId: 'payments-api',
  worktreePath: '/mock/worktrees/harborline/check',
});
const NORTHWIND = mountOf({
  mountId: 'm-n',
  sessionId: 's-n',
  workspaceId: 'w-northwind',
  projectId: 'notify-relay',
  worktreePath: '/mock/worktrees/northwind/check',
});
const OTHER_REPO = mountOf({
  mountId: 'm-l',
  sessionId: 's-h',
  workspaceId: 'w-harborline',
  projectId: 'ledger-core',
  worktreePath: '/mock/worktrees/harborline/ledger-check',
});

const TARGET: MonitoringTarget = {
  workspaceId: 'w-harborline',
  projectId: 'payments-api',
  branch: BRANCH,
};

const ledgerOf = ({
  spawnId,
  pid,
  sessionId,
  cwd,
}: {
  readonly spawnId: string;
  readonly pid: number;
  readonly sessionId: string;
  readonly cwd: string | null;
}): LedgerRow => ({
  spawnId,
  kind: 'terminal',
  pid,
  pgid: null,
  sessionId,
  mountPath: null,
  cwd,
  startedAt: pid,
});

const processOf = ({ pid, cwd }: { readonly pid: number; readonly cwd: string }) => ({
  pid,
  ppid: 1,
  pgid: pid,
  name: 'node',
  cwd,
  startedAt: 1,
  cpuPercent: 0,
  rssBytes: 1024,
  uid: 501,
  argsMasked: 'node watch.js',
});

const SNAPSHOT: MonitorSnapshot = {
  listeners: [],
  processes: [
    processOf({ pid: 1, cwd: HARBORLINE.worktreePath }),
    processOf({ pid: 2, cwd: NORTHWIND.worktreePath }),
    processOf({ pid: 3, cwd: OTHER_REPO.worktreePath }),
  ],
  takenAt: 10,
  isPlatformSupported: true,
};

const LEDGER: ReadonlyArray<LedgerRow> = [
  ledgerOf({ spawnId: 't1', pid: 1, sessionId: 's-h', cwd: `${HARBORLINE.worktreePath}/src` }),
  ledgerOf({ spawnId: 't2', pid: 2, sessionId: 's-n', cwd: `${NORTHWIND.worktreePath}/src` }),
  ledgerOf({ spawnId: 't3', pid: 3, sessionId: 's-h', cwd: `${OTHER_REPO.worktreePath}/src` }),
];

describe('a terminal process that listens on no port', () => {
  const rows = startedByGoodboy({
    snapshot: SNAPSHOT,
    ledger: LEDGER,
    projects: [],
    mounts: [HARBORLINE, NORTHWIND, OTHER_REPO],
  });

  it('is owned by the mount that contains its cwd', () => {
    expect(rows.find((row) => row.spawnId === 't1')?.mount).toBe(HARBORLINE);
  });

  it('shows on its own target only, not on the same branch of another workspace or repository', () => {
    const shown = rows
      .filter((row) => isOnTarget({ mount: row.mount, target: TARGET }))
      .map((row) => row.spawnId);

    expect(shown).toEqual(['t1']);
  });

  it('has no owner when the ledger records no path', () => {
    const lost = startedByGoodboy({
      snapshot: SNAPSHOT,
      ledger: [ledgerOf({ spawnId: 't1', pid: 1, sessionId: 's-h', cwd: null })],
      projects: [],
      mounts: [HARBORLINE],
    });

    expect(lost[0]?.mount).toBeNull();
    expect(isOnTarget({ mount: lost[0]?.mount ?? null, target: TARGET })).toBe(false);
  });
});
