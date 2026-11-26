// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import { nextSessionId } from '@goodboy/types/testing';
import { sourceFileOf } from './sourceFileOf';

const SESSION = nextSessionId();
const WORKTREE = '/work/payments-api';

const rowOf = (sessionId: string): PortRow => ({
  key: 'p5173',
  port: 5173,
  address: '127.0.0.1',
  pid: 4100,
  processName: 'node',
  state: 'listening',
  owner: {
    kind: 'script',
    spawnId: 'spawn-1',
    ledgerKind: 'script',
    sessionId,
    worktreePath: WORKTREE,
    projectId: null,
  },
  projectId: null,
  label: 'vite',
  source: 'vite',
  isWatched: true,
});

const processOf = (cwd: string | null): MonitorProcess => ({
  pid: 4100,
  ppid: 1,
  pgid: 4100,
  name: 'node',
  cwd,
  startedAt: 0,
  cpuPercent: 0,
  rssBytes: 0,
  uid: 501,
  argsMasked: 'vite',
});

const fileOf = (url: string, line = 214) =>
  sourceFileOf({
    url,
    line,
    sessionId: SESSION,
    rows: [rowOf(SESSION)],
    processes: [processOf(`${WORKTREE}/apps/web`)],
  });

describe('sourceFileOf', () => {
  it('maps a dev server frame into the session worktree, without its query', () => {
    expect(fileOf('http://localhost:5173/src/checkout/retry.ts?t=1764150000000')).toBe(
      'apps/web/src/checkout/retry.ts:214',
    );
    expect(fileOf('http://127.0.0.1:5173/src/checkout/Pay%20Button.tsx', 51)).toBe(
      'apps/web/src/checkout/Pay Button.tsx:51',
    );
  });

  it('keeps the served path when the server runs at the worktree root', () => {
    expect(
      sourceFileOf({
        url: 'http://localhost:5173/src/lib/poll.ts',
        line: 31,
        sessionId: SESSION,
        rows: [rowOf(SESSION)],
        processes: [processOf(WORKTREE)],
      }),
    ).toBe('src/lib/poll.ts:31');
  });

  it('reads library and tool paths as not ours', () => {
    expect(fileOf('http://localhost:5173/node_modules/.vite/deps/react-dom.js?v=4f2a')).toBeNull();
    expect(fileOf('http://localhost:5173/@vite/client')).toBeNull();
    expect(fileOf('http://localhost:5173/@fs/work/payments-api/src/main.tsx')).toBeNull();
    expect(fileOf('http://localhost:5173/')).toBeNull();
  });

  it('knows no file off loopback, for another session, for nobody or for a climbing path', () => {
    expect(fileOf('https://staging.harborline.dev:5173/src/checkout/retry.ts')).toBeNull();
    expect(fileOf('http://localhost:5173/src/%2e%2e/%2e%2e/etc/hosts')).toBeNull();
    expect(fileOf('http://localhost:5173/src/../../etc/hosts')).toBeNull();
    expect(fileOf('http://localhost:5173/src/checkout/retry.ts', 0)).toBeNull();
    expect(
      sourceFileOf({
        url: 'http://localhost:5173/src/checkout/retry.ts',
        line: 214,
        sessionId: SESSION,
        rows: [rowOf(nextSessionId())],
        processes: [],
      }),
    ).toBeNull();
    expect(
      sourceFileOf({
        url: 'http://localhost:5173/src/checkout/retry.ts',
        line: 214,
        sessionId: SESSION,
        rows: [],
        processes: [],
      }),
    ).toBeNull();
  });
});
