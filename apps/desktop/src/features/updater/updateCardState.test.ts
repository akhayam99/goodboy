// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { updateCardStateOf } from './updateCardState';

const DOWNLOAD_CUT = { phase: 'download', message: 'cut off' } as const;
const INSTALL_FAILED = { phase: 'install', message: 'disk full' } as const;
const CHECK_FAILED = { phase: 'check', message: 'offline' } as const;

describe('updateCardStateOf', () => {
  it.each([
    ['idle', null],
    ['checking', null],
    ['uptodate', null],
    ['error', null],
    ['available', 'available'],
    ['downloading-bg', 'available'],
    ['ready', 'ready'],
    ['downloading', 'ready'],
  ] as const)('reads %s as %s with nothing running', (status, expected) => {
    expect(updateCardStateOf({ status, failure: null, isQueued: false, runningCount: 0 })).toBe(
      expected,
    );
  });

  it('turns a ready update into the running card while agents run', () => {
    expect(
      updateCardStateOf({ status: 'ready', failure: null, isQueued: false, runningCount: 2 }),
    ).toBe('running');
    expect(
      updateCardStateOf({ status: 'downloading', failure: null, isQueued: false, runningCount: 2 }),
    ).toBe('ready');
  });

  it('says failed for a cut download or a failed install, never for a failed check', () => {
    expect(
      updateCardStateOf({
        status: 'available',
        failure: DOWNLOAD_CUT,
        isQueued: false,
        runningCount: 0,
      }),
    ).toBe('failed');
    expect(
      updateCardStateOf({
        status: 'ready',
        failure: INSTALL_FAILED,
        isQueued: false,
        runningCount: 3,
      }),
    ).toBe('failed');
    expect(
      updateCardStateOf({
        status: 'available',
        failure: CHECK_FAILED,
        isQueued: false,
        runningCount: 0,
      }),
    ).toBe('available');
  });

  it('leaves the failed card once a retry is under way', () => {
    expect(
      updateCardStateOf({
        status: 'downloading-bg',
        failure: DOWNLOAD_CUT,
        isQueued: false,
        runningCount: 0,
      }),
    ).toBe('available');
  });

  it('puts a queued restart ahead of every other state', () => {
    expect(
      updateCardStateOf({ status: 'ready', failure: null, isQueued: true, runningCount: 1 }),
    ).toBe('queued');
  });
});
