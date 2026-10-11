export type MonitorListener = {
  readonly port: number;
  readonly address: string;
  readonly protocol: 'tcp';
  readonly pid: number;
};

export type MonitorProcess = {
  readonly pid: number;
  readonly ppid: number;
  readonly pgid: number;
  readonly name: string;
  readonly cwd: string | null;
  readonly startedAt: number;
  readonly cpuPercent: number;
  readonly rssBytes: number;
  readonly uid: number;
  readonly argsMasked: string;
};

export type MonitorSnapshot = {
  readonly listeners: ReadonlyArray<MonitorListener>;
  readonly processes: ReadonlyArray<MonitorProcess>;
  readonly takenAt: number;
  readonly isPlatformSupported: boolean;
};

export type LedgerKind = 'turn' | 'chat' | 'planner' | 'summary' | 'script' | 'terminal' | 'probe';

export type LedgerRow = {
  readonly spawnId: string;
  readonly kind: LedgerKind;
  readonly pid: number;
  readonly pgid: number | null;
  readonly sessionId: string | null;
  readonly mountPath: string | null;
  readonly cwd: string | null;
  readonly startedAt: number;
};

export type WatchedSource = 'script' | 'env' | 'vite' | 'compose' | 'user' | 'learned';

export type WatchedPort = {
  readonly port: number;
  readonly label: string;
  readonly source: WatchedSource;
};

export type AttributionWorktree = {
  readonly path: string;
  readonly projectId: string | null;
};

export type AttributionSession = {
  readonly id: string;
  readonly worktrees: ReadonlyArray<AttributionWorktree>;
};

export type AttributionProject = {
  readonly id: string;
  readonly rootPath: string;
};

export type PortOwner =
  | {
      readonly kind: 'script' | 'terminal' | 'agent';
      readonly spawnId: string;
      readonly ledgerKind: LedgerKind;
      readonly sessionId: string | null;
      readonly worktreePath: string | null;
      readonly projectId: string | null;
    }
  | {
      readonly kind: 'worktree';
      readonly sessionId: string;
      readonly worktreePath: string;
      readonly projectId: string | null;
    }
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'external'; readonly name: string };

export type PortState = 'listening' | 'free';

export type PortRow = {
  readonly key: string;
  readonly port: number;
  readonly address: string | null;
  readonly pid: number | null;
  readonly processName: string | null;
  readonly state: PortState;
  readonly owner: PortOwner | null;
  readonly projectId: string | null;
  readonly label: string | null;
  readonly isWatched: boolean;
  readonly collision?: { readonly others: number };
};

export type LearnedPorts = Readonly<Record<string, ReadonlyArray<number>>>;

export type WatchedByProject = Readonly<Record<string, ReadonlyArray<WatchedPort>>>;

export type Leftover = {
  readonly spawnId: string;
  readonly kind: LedgerKind;
  readonly pgid: number;
  readonly sessionId: string | null;
  readonly mountPath: string | null;
  readonly processes: ReadonlyArray<MonitorProcess>;
};

export type Location = {
  readonly sessionId: string | null;
  readonly worktreePath: string | null;
  readonly projectId: string | null;
};
