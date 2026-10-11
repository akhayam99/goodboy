import { describe, expect, it } from 'vitest';
import { attributePorts } from './attributePorts';
import { collectLearnedPorts } from './collectLearnedPorts';
import { findLeftovers } from './findLeftovers';
import type {
  LedgerRow,
  MonitorProcess,
  MonitorSnapshot,
  PortRow,
  AttributionProject,
  AttributionSession,
} from './types';

const ROOT = '/work/ledger-core';
const WT_A = '/work/ledger-core/.worktrees/a';
const WT_NESTED = '/work/ledger-core/.worktrees/a/inner';
const WT_B = '/work/ledger-core/.worktrees/b';

const projects: ReadonlyArray<AttributionProject> = [
  { id: 'p1', rootPath: ROOT },
  { id: 'p2', rootPath: '/work/notify-relay' },
];

const sessions: ReadonlyArray<AttributionSession> = [
  {
    id: 's-a',
    worktrees: [
      { path: WT_A, projectId: 'p1' },
      { path: WT_NESTED, projectId: 'p1' },
    ],
  },
  { id: 's-b', worktrees: [{ path: WT_B, projectId: 'p1' }] },
];

const proc = (
  pid: number,
  cwd: string | null,
  extra: Partial<MonitorProcess> = {},
): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid,
  name: 'node',
  cwd,
  startedAt: 0,
  cpuPercent: 0,
  rssBytes: 0,
  uid: 501,
  argsMasked: '',
  ...extra,
});

const snap = (
  listeners: ReadonlyArray<[number, number]>,
  processes: ReadonlyArray<MonitorProcess>,
): MonitorSnapshot => ({
  listeners: listeners.map(([port, pid]) => ({ port, pid, address: '127.0.0.1', protocol: 'tcp' })),
  processes,
  takenAt: 1,
  isPlatformSupported: true,
});

const entry = (
  kind: LedgerRow['kind'],
  pid: number,
  extra: Partial<LedgerRow> = {},
): LedgerRow => ({
  spawnId: `${kind}-${pid}`,
  kind,
  pid,
  pgid: pid,
  sessionId: null,
  mountPath: null,
  cwd: null,
  startedAt: 0,
  ...extra,
});

const run = (
  snapshot: MonitorSnapshot,
  ledger: ReadonlyArray<LedgerRow> = [],
  watched: Record<
    string,
    ReadonlyArray<{ port: number; label: string; source: 'script'; relDir: string }>
  > = {},
  learned: Record<string, ReadonlyArray<number>> = {},
): ReadonlyArray<PortRow> =>
  attributePorts({ snapshot, ledger, sessions, projects, watched, learned });

describe('attributePorts owners', () => {
  it('names a Goodboy script by its ledger entry', () => {
    const rows = run(snap([[5173, 10]], [proc(10, WT_A)]), [
      entry('script', 10, { sessionId: 's-a', cwd: WT_A }),
    ]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'script', sessionId: 's-a', worktreePath: WT_A });
    expect(rows[0]?.projectId).toBe('p1');
  });

  it('matches a child of the script through the process group', () => {
    const rows = run(snap([[5173, 11]], [proc(11, WT_A, { pgid: 10, ppid: 10 })]), [
      entry('script', 10),
    ]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'script', worktreePath: WT_A });
  });

  it('names a terminal', () => {
    const rows = run(snap([[3000, 20]], [proc(20, WT_B)]), [entry('terminal', 20)]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'terminal', worktreePath: WT_B });
  });

  it('names an agent turn by its ledger kind', () => {
    const rows = run(snap([[3000, 30]], [proc(30, WT_B)]), [entry('turn', 30)]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'agent', ledgerKind: 'turn' });
  });

  it('prefers script over terminal over agent for the same process', () => {
    const rows = run(snap([[3000, 40]], [proc(40, WT_A)]), [
      entry('turn', 40),
      entry('terminal', 40),
      entry('script', 40),
    ]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'script' });
  });

  it('ignores probe ledger entries', () => {
    const rows = run(snap([[3000, 50]], [proc(50, WT_A)]), [entry('probe', 50)]);
    expect(rows[0]?.owner).toMatchObject({ kind: 'worktree', sessionId: 's-a' });
  });

  it('uses the longest cwd prefix between nested worktrees', () => {
    const rows = run(snap([[3000, 60]], [proc(60, `${WT_NESTED}/src`)]));
    expect(rows[0]?.owner).toMatchObject({
      kind: 'worktree',
      sessionId: 's-a',
      worktreePath: WT_NESTED,
    });
  });

  it('does not match a sibling directory that shares a name prefix', () => {
    const rows = run(snap([[3000, 61]], [proc(61, `${WT_A}-other`)]));
    expect(rows[0]?.owner).toMatchObject({ kind: 'project', projectId: 'p1' });
  });

  it('falls back to the project main checkout', () => {
    const rows = run(snap([[3000, 70]], [proc(70, `${ROOT}/apps/web`)]));
    expect(rows[0]?.owner).toEqual({ kind: 'project', projectId: 'p1' });
  });

  it('reports an external process by name only', () => {
    const rows = run(snap([[5000, 80]], [proc(80, '/Users/x/other', { name: 'ControlCenter' })]));
    expect(rows[0]?.owner).toEqual({ kind: 'external', name: 'ControlCenter' });
    expect(rows[0]?.projectId).toBeNull();
  });

  it('reports an unknown process when the snapshot has no row for the pid', () => {
    const rows = run(snap([[5000, 81]], []));
    expect(rows[0]?.owner).toEqual({ kind: 'external', name: 'unknown' });
  });

  it('merges IPv4 and IPv6 listeners of one process into one row', () => {
    const snapshot: MonitorSnapshot = {
      ...snap([[8080, 90]], [proc(90, WT_A)]),
      listeners: [
        { port: 8080, pid: 90, address: '*', protocol: 'tcp' },
        { port: 8080, pid: 90, address: '::1', protocol: 'tcp' },
      ],
    };
    expect(run(snapshot)).toHaveLength(1);
  });
});

describe('attributePorts watched set', () => {
  const watched = { p1: [{ port: 5005, label: 'dev', source: 'script' as const, relDir: '' }] };

  it('returns a free row for a watched port nobody holds', () => {
    const rows = run(snap([], []), [], watched);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      state: 'free',
      port: 5005,
      projectId: 'p1',
      label: 'dev',
      isWatched: true,
    });
  });

  it('turns the free row into a listening row when the port is held', () => {
    const rows = run(snap([[5005, 10]], [proc(10, WT_A)]), [entry('script', 10)], watched);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'listening', isWatched: true, label: 'dev' });
  });

  it('includes learned ports as free rows', () => {
    const rows = run(snap([], []), [], {}, { p1: [4321] });
    expect(rows[0]).toMatchObject({ state: 'free', port: 4321, projectId: 'p1' });
  });

  it('flags a collision when another worktree of the project is running', () => {
    const rows = run(
      snap([[5005, 10]], [proc(10, WT_A)]),
      [entry('script', 10, { cwd: WT_A }), entry('script', 20, { cwd: WT_B })],
      watched,
    );
    expect(rows[0]?.collision).toEqual({ others: 1 });
  });

  it('has no collision when only the holder worktree runs', () => {
    const rows = run(
      snap([[5005, 10]], [proc(10, WT_A)]),
      [entry('script', 10, { cwd: WT_A })],
      watched,
    );
    expect(rows[0]?.collision).toBeUndefined();
  });

  it('has no collision for a port outside the watched set', () => {
    const rows = run(
      snap([[6006, 10]], [proc(10, WT_A)]),
      [entry('script', 10, { cwd: WT_A }), entry('script', 20, { cwd: WT_B })],
      watched,
    );
    expect(rows.find((row) => row.port === 6006)?.collision).toBeUndefined();
  });

  it('orders rows by port', () => {
    const rows = run(
      snap(
        [
          [9000, 1],
          [3000, 2],
        ],
        [proc(1, '/x'), proc(2, '/y')],
      ),
    );
    expect(rows.map((row) => row.port)).toEqual([3000, 9000]);
  });
});

describe('collectLearnedPorts', () => {
  it('adds a port held by a Goodboy-owned process to its project', () => {
    const rows = run(snap([[5173, 10]], [proc(10, WT_A)]), [entry('script', 10)]);
    expect(collectLearnedPorts({ rows, learned: {} })).toEqual({ p1: [5173] });
  });

  it('ignores external and plain worktree holders', () => {
    const rows = run(
      snap(
        [
          [5173, 10],
          [3000, 11],
        ],
        [proc(10, WT_A), proc(11, '/else')],
      ),
    );
    const learned = {};
    expect(collectLearnedPorts({ rows, learned })).toBe(learned);
  });

  it('keeps the same reference when the port is already learned', () => {
    const rows = run(snap([[5173, 10]], [proc(10, WT_A)]), [entry('script', 10)]);
    const learned = { p1: [5173] };
    expect(collectLearnedPorts({ rows, learned })).toBe(learned);
  });
});

describe('findLeftovers', () => {
  it('reports a group whose leader is gone but members live', () => {
    const snapshot = snap([], [proc(11, WT_A, { pgid: 10 })]);
    const leftovers = findLeftovers({ snapshot, ledger: [entry('script', 10)] });
    expect(leftovers).toHaveLength(1);
    expect(leftovers[0]?.processes.map((p) => p.pid)).toEqual([11]);
  });

  it('skips a group whose leader is alive and a group with nobody left', () => {
    const snapshot = snap([], [proc(10, WT_A), proc(11, WT_A, { pgid: 10 })]);
    expect(findLeftovers({ snapshot, ledger: [entry('script', 10), entry('script', 99)] })).toEqual(
      [],
    );
  });

  it('skips probes and entries without a group', () => {
    const snapshot = snap([], [proc(11, WT_A, { pgid: 10 })]);
    expect(
      findLeftovers({
        snapshot,
        ledger: [entry('probe', 10), entry('script', 12, { pgid: null })],
      }),
    ).toEqual([]);
  });
});
