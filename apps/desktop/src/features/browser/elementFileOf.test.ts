// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import type { SessionId } from '@goodboy/types';
import { elementFileOf } from './elementFileOf';
import type { BrowserPickedElement } from './types';

const SESSION = 'session-harborline' as SessionId;
const WORKTREE = '/work/payments-api';

const PAY: BrowserPickedElement = {
  tag: 'button',
  label: 'button.pay',
  selector: 'button.pay',
  text: 'Pay',
  html: '<button>Pay</button>',
  isHtmlCut: false,
  styles: [],
  component: 'PayButton',
  source: { path: '/src/checkout/PayButton.tsx', line: 42 },
  isSourceSettled: true,
  rect: null,
  url: 'http://localhost:5173/checkout',
};

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

describe('elementFileOf', () => {
  it('maps the dev server path into the session worktree', () => {
    expect(
      elementFileOf({
        element: PAY,
        sessionId: SESSION,
        rows: [rowOf(SESSION)],
        processes: [processOf(`${WORKTREE}/apps/web`)],
      }),
    ).toBe('apps/web/src/checkout/PayButton.tsx:42');
  });

  it('keeps the served path when the server runs at the worktree root', () => {
    expect(
      elementFileOf({
        element: PAY,
        sessionId: SESSION,
        rows: [rowOf(SESSION)],
        processes: [processOf(WORKTREE)],
      }),
    ).toBe('src/checkout/PayButton.tsx:42');
  });

  it('knows no file when the port belongs to another session or to nobody', () => {
    expect(
      elementFileOf({ element: PAY, sessionId: SESSION, rows: [rowOf('other')], processes: [] }),
    ).toBeNull();
    expect(elementFileOf({ element: PAY, sessionId: SESSION, rows: [], processes: [] })).toBeNull();
  });

  it('knows no file for a page off loopback, without a source or with a path that climbs', () => {
    const rows = [rowOf(SESSION)];
    expect(
      elementFileOf({
        element: { ...PAY, url: 'https://staging.harborline.dev:5173/checkout' },
        sessionId: SESSION,
        rows,
        processes: [],
      }),
    ).toBeNull();
    expect(
      elementFileOf({ element: { ...PAY, source: null }, sessionId: SESSION, rows, processes: [] }),
    ).toBeNull();
    expect(
      elementFileOf({
        element: { ...PAY, source: { path: '/src/../../etc/hosts', line: 1 } },
        sessionId: SESSION,
        rows,
        processes: [],
      }),
    ).toBeNull();
  });
});
