import type {
  LedgerRow,
  MonitorListener,
  MonitorProcess,
  MonitorSnapshot,
  WatchedPort,
} from '@goodboy/core';
import { sceneClock } from '../../sceneClock';
import { LEDGER, PROJECTS, SESSION_ID, SESSION_MOUNTS, SNAPSHOT } from '../u24/monitoringSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const TAKEN_AT = clock.ms({ at: '2026-10-10T09:12:00.000Z' });
const MINUTE = 60_000;

const PAYMENTS_ID = PROJECTS[0]?.id ?? '';
const PAYMENTS_TREE = SESSION_MOUNTS[SESSION_ID]?.[0]?.worktreePath ?? null;

const DEV_SERVER: MonitorProcess = {
  pid: 4300,
  ppid: 1,
  pgid: 4300,
  name: 'vite',
  cwd: PAYMENTS_TREE,
  startedAt: TAKEN_AT - 18 * MINUTE,
  cpuPercent: 0.8,
  rssBytes: 176 * 1024 * 1024,
  uid: 501,
  argsMasked: 'vite --port 5173',
};

const DEV_LISTENER: MonitorListener = {
  port: 5173,
  address: '127.0.0.1',
  protocol: 'tcp',
  pid: 4300,
};

export const PORTS_SNAPSHOT: MonitorSnapshot = {
  ...SNAPSHOT,
  listeners: [...SNAPSHOT.listeners, DEV_LISTENER],
  processes: [...SNAPSHOT.processes, DEV_SERVER],
};

const DEV_SCRIPT: LedgerRow = {
  spawnId: 'mock-u25-spawn-dev',
  kind: 'script',
  pid: 4300,
  pgid: 4300,
  sessionId: SESSION_ID,
  mountPath: PAYMENTS_TREE,
  cwd: PAYMENTS_TREE,
  startedAt: TAKEN_AT - 18 * MINUTE,
};

export const PORTS_LEDGER: ReadonlyArray<LedgerRow> = [...LEDGER, DEV_SCRIPT];

export const PORTS_SCANNED: Readonly<Record<string, ReadonlyArray<WatchedPort>>> = {
  [PAYMENTS_ID]: [
    { port: 5005, label: 'web', source: 'env', relDir: '' },
    { port: 5002, label: 'blog', source: 'vite', relDir: '' },
    { port: 5006, label: 'docs', source: 'script', relDir: '' },
  ],
};

export const PORTS_LEARNED: Readonly<Record<string, ReadonlyArray<number>>> = {
  [PAYMENTS_ID]: [4321],
};

export const PORTS_SETTINGS: Readonly<Record<string, string>> = {
  'monitor.pinnedPorts': JSON.stringify([
    { port: 5005, description: 'Payments web' },
    { port: 9000, description: 'Mock API' },
  ]),
  'monitor.hiddenPorts': JSON.stringify([{ port: 5006, source: 'workspace' }]),
};
