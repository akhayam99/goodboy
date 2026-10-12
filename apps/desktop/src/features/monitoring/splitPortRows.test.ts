import { describe, expect, it } from 'vitest';
import type { PortOwner, PortRow, WatchedSource } from '@goodboy/core';
import { splitPortRows } from './splitPortRows';
import { unmatchedStarted } from './unmatchedStarted';
import { workspacePortSet } from './workspacePortSet';
import type { StartedRow } from './startedByGoodboy';

type RowParams = {
  readonly port: number;
  readonly state?: PortRow['state'];
  readonly source?: WatchedSource | null;
  readonly owner?: PortOwner | null;
  readonly projectId?: string | null;
  readonly pid?: number | null;
};

const rowOf = ({
  port,
  state = 'listening',
  source = null,
  owner = null,
  projectId = null,
  pid = state === 'listening' ? port : null,
}: RowParams): PortRow => ({
  key: state === 'free' ? `free:${projectId}:${port}` : `${port}:${pid}`,
  port,
  address: null,
  pid,
  processName: state === 'listening' ? 'node' : null,
  state,
  owner,
  projectId,
  label: source === null ? null : 'dev',
  source,
  isWatched: source !== null,
});

type SpawnParams = {
  readonly spawnId: string;
};

const agentOwner = ({ spawnId }: SpawnParams): PortOwner => ({
  kind: 'agent',
  spawnId,
  ledgerKind: 'turn',
  sessionId: null,
  worktreePath: null,
  projectId: 'p1',
});

const NO_WORKSPACE: ReadonlySet<number> = new Set();

type PortsParams = {
  readonly rows: ReadonlyArray<PortRow>;
};

const portsOf = ({ rows }: PortsParams) => rows.map((row) => row.port);

describe('splitPortRows', () => {
  it('returns four empty layers for no rows and nothing pinned', () => {
    expect(
      splitPortRows({ rows: [], pinned: [], hidden: [], workspacePorts: NO_WORKSPACE }),
    ).toEqual({ pinned: [], goodboy: [], workspace: [], listening: [], hiddenCount: 0 });
  });

  it('puts a port in the first layer that claims it: Pinned, Goodboy, workspace, the rest', () => {
    const rows = [
      rowOf({ port: 3000, source: 'script', owner: agentOwner({ spawnId: 'a' }), projectId: 'p1' }),
      rowOf({ port: 4000, source: 'env', projectId: 'p1' }),
      rowOf({ port: 5000, owner: agentOwner({ spawnId: 'b' }), projectId: 'p1' }),
      rowOf({ port: 6000 }),
      rowOf({ port: 7000, source: 'script', owner: agentOwner({ spawnId: 'c' }), projectId: 'p1' }),
    ];

    const split = splitPortRows({
      rows,
      pinned: [{ port: 7000, description: 'Docs' }],
      hidden: [],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.pinned })).toEqual([7000]);
    expect(portsOf({ rows: split.goodboy })).toEqual([3000, 5000]);
    expect(portsOf({ rows: split.workspace })).toEqual([4000]);
    expect(portsOf({ rows: split.listening })).toEqual([6000]);
  });

  it('never repeats a port across layers', () => {
    const rows = [
      rowOf({ port: 3000, source: 'script', owner: agentOwner({ spawnId: 'a' }), projectId: 'p1' }),
      rowOf({ port: 3000, state: 'free', source: 'env', projectId: 'p2' }),
    ];

    const split = splitPortRows({
      rows,
      pinned: [],
      hidden: [],
      workspacePorts: new Set([3000]),
    });
    const all = [...split.pinned, ...split.goodboy, ...split.workspace, ...split.listening];

    expect(portsOf({ rows: all })).toEqual([3000]);
    expect(portsOf({ rows: split.goodboy })).toEqual([3000]);
  });

  it('learned ports belong to Run by Goodboy even when free', () => {
    const split = splitPortRows({
      rows: [rowOf({ port: 4321, state: 'free', source: 'learned', projectId: 'p1' })],
      pinned: [],
      hidden: [],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.goodboy })).toEqual([4321]);
    expect(split.workspace).toEqual([]);
  });

  it('shows one row for a port two projects declare', () => {
    const rows = [
      rowOf({ port: 3000, state: 'free', source: 'script', projectId: 'p1' }),
      rowOf({ port: 3000, state: 'free', source: 'vite', projectId: 'p2' }),
    ];

    const split = splitPortRows({
      rows,
      pinned: [],
      hidden: [],
      workspacePorts: new Set([3000]),
    });

    expect(split.workspace.map((row) => row.projectId)).toEqual(['p1']);
  });

  it('keeps every listener of a port together and drops its free row', () => {
    const rows = [
      rowOf({ port: 3000, pid: 10, source: 'script', projectId: 'p1' }),
      rowOf({ port: 3000, pid: 11, source: 'script', projectId: 'p1' }),
      rowOf({ port: 3000, state: 'free', source: 'script', projectId: 'p2' }),
    ];

    const split = splitPortRows({
      rows,
      pinned: [],
      hidden: [],
      workspacePorts: new Set([3000]),
    });

    expect(split.workspace.map((row) => row.pid)).toEqual([10, 11]);
  });

  it('files an outside process on a port the workspace declares under From workspace', () => {
    const split = splitPortRows({
      rows: [rowOf({ port: 3000, owner: { kind: 'external', name: 'node' } })],
      pinned: [],
      hidden: [],
      workspacePorts: new Set([3000]),
    });

    expect(portsOf({ rows: split.workspace })).toEqual([3000]);
    expect(split.listening).toEqual([]);
  });

  it('pins a free port as a synthesized row that carries its description', () => {
    const split = splitPortRows({
      rows: [],
      pinned: [{ port: 999, description: 'Mock API' }],
      hidden: [],
      workspacePorts: NO_WORKSPACE,
    });

    expect(split.pinned).toHaveLength(1);
    expect(split.pinned[0]).toMatchObject({
      port: 999,
      state: 'free',
      label: 'Mock API',
      projectId: null,
    });
  });

  it('pins a listening port as its real row and an empty description as no label', () => {
    const split = splitPortRows({
      rows: [
        rowOf({ port: 5005, source: 'env', projectId: 'p1' }),
        rowOf({ port: 5005, state: 'free', source: 'env', projectId: 'p2' }),
      ],
      pinned: [{ port: 5005, description: '' }],
      hidden: [],
      workspacePorts: new Set([5005]),
    });

    expect(split.pinned).toHaveLength(1);
    expect(split.pinned[0]).toMatchObject({ state: 'listening', pid: 5005, label: null });
    expect(split.workspace).toEqual([]);
  });

  it('orders pins by port', () => {
    const split = splitPortRows({
      rows: [],
      pinned: [
        { port: 9000, description: '' },
        { port: 80, description: '' },
      ],
      hidden: [],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.pinned })).toEqual([80, 9000]);
  });

  it('hides a port only in the layer it was hidden from and counts it', () => {
    const rows = [
      rowOf({ port: 3000, source: 'script', projectId: 'p1' }),
      rowOf({ port: 4000, owner: agentOwner({ spawnId: 'a' }), projectId: 'p1' }),
      rowOf({ port: 5000, source: 'env', projectId: 'p1' }),
    ];

    const split = splitPortRows({
      rows,
      pinned: [],
      hidden: [
        { port: 3000, source: 'workspace' },
        { port: 4000, source: 'workspace' },
        { port: 5000, source: 'goodboy' },
      ],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.workspace })).toEqual([5000]);
    expect(portsOf({ rows: split.goodboy })).toEqual([4000]);
    expect(split.hiddenCount).toBe(1);
  });

  it('shows a hidden port again once it is pinned', () => {
    const split = splitPortRows({
      rows: [rowOf({ port: 3000, source: 'script', projectId: 'p1' })],
      pinned: [{ port: 3000, description: '' }],
      hidden: [{ port: 3000, source: 'workspace' }],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.pinned })).toEqual([3000]);
    expect(split.hiddenCount).toBe(0);
  });
});

describe('workspacePortSet', () => {
  it('collects the scanned ports of every project', () => {
    const ports = workspacePortSet({
      scanned: {
        p1: [{ port: 5005, label: 'web', source: 'env', relDir: '' }],
        p2: [{ port: 3000, label: 'dev', source: 'vite', relDir: '' }],
      },
    });

    expect([...ports].sort()).toEqual([3000, 5005]);
  });
});

describe('unmatchedStarted', () => {
  const started = ({ spawnId }: SpawnParams): StartedRow => ({
    spawnId,
    kind: 'turn',
    name: 'Agent · claude',
    where: 'payments-api',
    startedAt: 0,
    rssBytes: 0,
    pid: 1,
  });

  it('drops a started process whose port row is already listed', () => {
    const rows = [rowOf({ port: 5005, owner: agentOwner({ spawnId: 'a' }) })];

    expect(
      unmatchedStarted({ started: [started({ spawnId: 'a' }), started({ spawnId: 'b' })], rows }),
    ).toEqual([started({ spawnId: 'b' })]);
  });

  it('keeps every started process when no row is owned by Goodboy', () => {
    const rows = [rowOf({ port: 5005, owner: { kind: 'external', name: 'node' } })];

    expect(unmatchedStarted({ started: [started({ spawnId: 'a' })], rows })).toHaveLength(1);
  });

  it('drops a hidden listening port from its layer and counts it', () => {
    const split = splitPortRows({
      rows: [rowOf({ port: 6000 }), rowOf({ port: 6001 })],
      pinned: [],
      hidden: [{ port: 6000, source: 'listening' }],
      workspacePorts: NO_WORKSPACE,
    });

    expect(portsOf({ rows: split.listening })).toEqual([6001]);
    expect(split.hiddenCount).toBe(1);
  });
});
