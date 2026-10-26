import { describe, expect, it } from 'vitest';
import { LONG_COMMAND_MS, terminalFinishesOf } from './terminalFinishesOf';

const busy = { id: 'term-1', cwd: '/w/ledger', pid: 10, foregroundPid: 11 };
const idle = { id: 'term-1', cwd: '/w/ledger', pid: 10, foregroundPid: 10 };
const OWNED = new Set(['term-1']);

describe('terminalFinishesOf', () => {
  it('starts the clock the first time it sees a job running', () => {
    const result = terminalFinishesOf({
      live: [busy],
      busySince: new Map(),
      now: 5_000,
      ownedIds: OWNED,
    });
    expect([...result.busySince]).toEqual([['term-1', 5_000]]);
    expect(result.finished).toEqual([]);
  });

  it('keeps the first time while the job runs', () => {
    const result = terminalFinishesOf({
      live: [busy],
      busySince: new Map([['term-1', 5_000]]),
      now: 20_000,
      ownedIds: OWNED,
    });
    expect([...result.busySince]).toEqual([['term-1', 5_000]]);
    expect(result.finished).toEqual([]);
  });

  it('reports a job that ran for more than 10 seconds once the shell is idle again', () => {
    const result = terminalFinishesOf({
      live: [idle],
      busySince: new Map([['term-1', 5_000]]),
      now: 5_000 + LONG_COMMAND_MS,
      ownedIds: OWNED,
    });
    expect(result.finished).toEqual([{ terminalId: 'term-1', durationMs: LONG_COMMAND_MS }]);
    expect(result.busySince.size).toBe(0);
  });

  it('does not report a short job', () => {
    const result = terminalFinishesOf({
      live: [idle],
      busySince: new Map([['term-1', 5_000]]),
      now: 5_000 + LONG_COMMAND_MS - 1,
      ownedIds: OWNED,
    });
    expect(result.finished).toEqual([]);
    expect(result.busySince.size).toBe(0);
  });

  it('reports a long job whose terminal is gone', () => {
    const result = terminalFinishesOf({
      live: [],
      busySince: new Map([['term-1', 0]]),
      now: 60_000,
      ownedIds: OWNED,
    });
    expect(result.finished).toEqual([{ terminalId: 'term-1', durationMs: 60_000 }]);
  });

  it('ignores terminals the session does not own', () => {
    const result = terminalFinishesOf({
      live: [busy],
      busySince: new Map(),
      now: 1_000,
      ownedIds: new Set(),
    });
    expect(result.busySince.size).toBe(0);
  });
});
