import { describe, expect, it } from 'vitest';
import type { MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { brandedId } from '../../../features/history/testing/brandedId';
import type { MountId, SessionId } from '@goodboy/types';
import { mountCleanupBlockers, processesInWorktree } from './cleanupPolicy';

const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandedId<MountId>({ value: 'mount-credit' });
const WORKTREE = '/work/worktrees/hl-fix-duplicate-credit/payments-api';

const processIn = ({ pid, cwd }: { readonly pid: number; readonly cwd: string | null }) =>
  ({
    pid,
    ppid: 1,
    pgid: pid,
    name: 'next-server',
    cwd,
    startedAt: 0,
    cpuPercent: 0,
    rssBytes: 0,
    uid: 501,
    argsMasked: '',
  }) satisfies MonitorProcess;

const snapshotOf = ({
  processes,
}: {
  readonly processes: ReadonlyArray<MonitorProcess>;
}): MonitorSnapshot => ({ listeners: [], processes, takenAt: 1, isPlatformSupported: true });

const blockersFor = ({ snapshot }: { readonly snapshot: MonitorSnapshot | null }) =>
  mountCleanupBlockers({
    state: {
      sessions: [],
      terminalTabs: {},
      sessionPhaseRuns: {},
      agentTurnDestination: {},
      sessionResolveAttempts: {},
      monitorSnapshot: snapshot,
    },
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    worktreePath: WORKTREE,
  });

describe('the process-running blocker', () => {
  it('blocks when a snapshot process has its cwd inside the worktree', () => {
    const snapshot = snapshotOf({
      processes: [processIn({ pid: 90, cwd: `${WORKTREE}/apps/web` })],
    });

    expect(blockersFor({ snapshot })).toEqual(['process-running']);
  });

  it('blocks on the worktree folder itself', () => {
    const snapshot = snapshotOf({ processes: [processIn({ pid: 90, cwd: WORKTREE })] });

    expect(blockersFor({ snapshot })).toEqual(['process-running']);
  });

  it('ignores a sibling folder that shares the name prefix and a process without a cwd', () => {
    const snapshot = snapshotOf({
      processes: [
        processIn({ pid: 90, cwd: `${WORKTREE}-old` }),
        processIn({ pid: 91, cwd: null }),
      ],
    });

    expect(blockersFor({ snapshot })).toEqual([]);
  });

  it('does not block before the first snapshot', () => {
    expect(blockersFor({ snapshot: null })).toEqual([]);
  });

  it('names the processes that hold the folder', () => {
    const snapshot = snapshotOf({
      processes: [processIn({ pid: 90, cwd: WORKTREE }), processIn({ pid: 91, cwd: '/elsewhere' })],
    });

    expect(
      processesInWorktree({ snapshot, worktreePath: WORKTREE }).map((item) => item.pid),
    ).toEqual([90]);
  });
});
