import type {
  HiddenPort,
  HiddenPortSource,
  PinnedPort,
  PortRow,
  WatchedSource,
} from '@goodboy/core';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly pinned: ReadonlyArray<PinnedPort>;
  readonly hidden: ReadonlyArray<HiddenPort>;
  readonly workspacePorts: ReadonlySet<number>;
};

type Layer = 'goodboy' | 'workspace' | 'listening';

type LayerParams = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly workspacePorts: ReadonlySet<number>;
};

type RowParams = {
  readonly row: PortRow;
};

type RowsParams = {
  readonly rows: ReadonlyArray<PortRow>;
};

type IsHiddenParams = {
  readonly hidden: ReadonlyArray<HiddenPort>;
  readonly port: number;
  readonly source: HiddenPortSource;
};

type PinnedRowParams = {
  readonly pin: PinnedPort;
  readonly rows: ReadonlyArray<PortRow>;
};

export type SplitPortRows = {
  readonly pinned: ReadonlyArray<PortRow>;
  readonly goodboy: ReadonlyArray<PortRow>;
  readonly workspace: ReadonlyArray<PortRow>;
  readonly listening: ReadonlyArray<PortRow>;
  readonly hiddenCount: number;
};

const WORKSPACE_SOURCES: ReadonlyArray<WatchedSource> = ['script', 'env', 'vite', 'compose'];

const isGoodboyRun = ({ row }: RowParams): boolean =>
  row.owner?.kind === 'script' ||
  row.owner?.kind === 'terminal' ||
  row.owner?.kind === 'agent' ||
  row.source === 'learned';

const isFromWorkspace = ({ row }: RowParams): boolean =>
  row.source !== null && WORKSPACE_SOURCES.includes(row.source);

const layerOf = ({ rows, workspacePorts }: LayerParams): Layer => {
  if (rows.some((row) => isGoodboyRun({ row }))) {
    return 'goodboy';
  }
  const port = rows[0]?.port;
  if (
    rows.some((row) => isFromWorkspace({ row })) ||
    (port !== undefined && workspacePorts.has(port))
  ) {
    return 'workspace';
  }
  return 'listening';
};

const pinnedRowsOf = ({ pin, rows }: PinnedRowParams): ReadonlyArray<PortRow> => {
  const label = pin.description === '' ? null : pin.description;
  const listening = rows.filter((row) => row.state === 'listening');
  if (listening.length > 0) {
    return listening.map((row) => ({ ...row, label, isWatched: true }));
  }
  return [
    {
      key: `pinned:${pin.port}`,
      port: pin.port,
      address: null,
      pid: null,
      processName: null,
      state: 'free',
      owner: null,
      projectId: null,
      label,
      source: 'user',
      isWatched: true,
    },
  ];
};

const rowsToShow = ({ rows }: RowsParams): ReadonlyArray<PortRow> => {
  const listening = rows.filter((row) => row.state === 'listening');
  if (listening.length > 0) {
    return listening;
  }
  return rows.slice(0, 1);
};

const isHidden = ({ hidden, port, source }: IsHiddenParams): boolean =>
  hidden.some((item) => item.port === port && item.source === source);

export const splitPortRows = ({ rows, pinned, hidden, workspacePorts }: Params): SplitPortRows => {
  const byPort = new Map<number, PortRow[]>();
  for (const row of rows) {
    byPort.set(row.port, [...(byPort.get(row.port) ?? []), row]);
  }
  const pinnedPorts = new Set(pinned.map((pin) => pin.port));
  const sections: Record<Layer, PortRow[]> = { goodboy: [], workspace: [], listening: [] };
  let hiddenCount = 0;
  for (const [port, group] of byPort) {
    if (pinnedPorts.has(port)) {
      continue;
    }
    const layer = layerOf({ rows: group, workspacePorts });
    if (isHidden({ hidden, port, source: layer })) {
      hiddenCount += 1;
      continue;
    }
    sections[layer].push(...rowsToShow({ rows: group }));
  }
  const pinnedRows = [...pinned]
    .sort((a, b) => a.port - b.port)
    .flatMap((pin) => pinnedRowsOf({ pin, rows: byPort.get(pin.port) ?? [] }));
  return { pinned: pinnedRows, ...sections, hiddenCount };
};
