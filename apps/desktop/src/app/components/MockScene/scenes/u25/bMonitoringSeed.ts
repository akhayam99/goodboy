import type {
  LedgerRow,
  MonitorListener,
  MonitorProcess,
  MonitorSnapshot,
  WatchedPort,
} from '@goodboy/core';
import { sceneClock } from '../../sceneClock';
import { PROJECTS, SESSION_ID, SESSION_MOUNTS, SNAPSHOT } from '../u24/monitoringSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const TAKEN_AT = clock.ms({ at: '2026-10-10T09:12:00.000Z' });
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const PAYMENTS_ID = PROJECTS[0]?.id ?? '';
const PAYMENTS_TREE = SESSION_MOUNTS[SESSION_ID]?.[0]?.worktreePath ?? null;
const PAYMENTS_ROOT = PROJECTS[0]?.rootPath ?? null;

type ProcessParams = {
  readonly pid: number;
  readonly name: string;
  readonly cwd: string | null;
  readonly args: string;
  readonly ageMs: number;
  readonly cpuPercent: number;
  readonly rssMb: number;
};

const processOf = ({
  pid,
  name,
  cwd,
  args,
  ageMs,
  cpuPercent,
  rssMb,
}: ProcessParams): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid,
  name,
  cwd,
  startedAt: TAKEN_AT - ageMs,
  cpuPercent,
  rssBytes: rssMb * 1024 * 1024,
  uid: 501,
  argsMasked: args,
});

type ListenerParams = {
  readonly pid: number;
  readonly ports: ReadonlyArray<number>;
};

const listenersOf = ({ pid, ports }: ListenerParams): ReadonlyArray<MonitorListener> =>
  ports.map((port) => ({ port, address: '127.0.0.1', protocol: 'tcp', pid }));

const DOCKER_PORTS = [80, 2019, 3030, 3031, 3306, 4222, 6379, 8222, 5432];

export const BUSY_SNAPSHOT: MonitorSnapshot = {
  ...SNAPSHOT,
  listeners: [
    ...SNAPSHOT.listeners,
    ...listenersOf({ pid: 31740, ports: DOCKER_PORTS }),
    ...listenersOf({ pid: 6100, ports: [10350, 62412] }),
    ...listenersOf({ pid: 6200, ports: [4001] }),
  ],
  processes: [
    ...SNAPSHOT.processes,
    processOf({
      pid: 31740,
      name: 'com.docker.backend',
      cwd: null,
      args: 'com.docker.backend services',
      ageMs: 2 * HOUR,
      cpuPercent: 0.8,
      rssMb: 57,
    }),
    processOf({
      pid: 6100,
      name: 'tilt',
      cwd: PAYMENTS_ROOT,
      args: 'tilt up --port 10350',
      ageMs: 2 * HOUR,
      cpuPercent: 0,
      rssMb: 35,
    }),
    processOf({
      pid: 6200,
      name: 'node',
      cwd: PAYMENTS_ROOT,
      args: 'node mock-api.js --port 4001',
      ageMs: 31 * MINUTE,
      cpuPercent: 0.2,
      rssMb: 28,
    }),
    processOf({
      pid: 6301,
      name: 'zsh',
      cwd: PAYMENTS_ROOT,
      args: '-zsh',
      ageMs: 2 * HOUR,
      cpuPercent: 0,
      rssMb: 1,
    }),
  ],
};

type LedgerParams = {
  readonly spawnId: string;
  readonly pid: number;
  readonly ageMs: number;
};

const terminalOf = ({ spawnId, pid, ageMs }: LedgerParams): LedgerRow => ({
  spawnId,
  kind: 'terminal',
  pid,
  pgid: pid,
  sessionId: null,
  mountPath: null,
  cwd: PAYMENTS_ROOT,
  startedAt: TAKEN_AT - ageMs,
});

export const BUSY_LEDGER: ReadonlyArray<LedgerRow> = [
  terminalOf({ spawnId: 'mock-u25-terminal-tilt', pid: 6100, ageMs: 2 * HOUR }),
  terminalOf({ spawnId: 'mock-u25-terminal-mock', pid: 6200, ageMs: 31 * MINUTE }),
  terminalOf({ spawnId: 'mock-u25-terminal-shell', pid: 6301, ageMs: 2 * HOUR }),
];

type ComposeParams = {
  readonly port: number;
};

const composeOf = ({ port }: ComposeParams): WatchedPort => ({
  port,
  label: 'compose',
  source: 'compose',
  relDir: '',
});

export const BUSY_SCANNED: Readonly<Record<string, ReadonlyArray<WatchedPort>>> = {
  [PAYMENTS_ID]: [
    { port: 5005, label: 'web', source: 'env', relDir: '' },
    { port: 5001, label: 'dev', source: 'vite', relDir: '' },
    { port: 5002, label: 'blog', source: 'vite', relDir: '' },
    { port: 5003, label: 'dev', source: 'vite', relDir: '' },
    { port: 7001, label: 'storybook', source: 'script', relDir: '' },
    { port: 7002, label: 'storybook', source: 'script', relDir: '' },
    ...DOCKER_PORTS.map((port) => composeOf({ port })),
  ],
};

export const BUSY_LEARNED: Readonly<Record<string, ReadonlyArray<number>>> = {
  [PAYMENTS_ID]: [10350, 62412, 4001],
};

export const BUSY_SETTINGS: Readonly<Record<string, string>> = {
  'monitor.pinnedPorts': JSON.stringify([
    { port: 3000, description: 'Ledger web' },
    { port: 9000, description: 'Mock API' },
  ]),
  'monitor.hiddenPorts': JSON.stringify([]),
};
