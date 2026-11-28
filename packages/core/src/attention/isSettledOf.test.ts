import { describe, expect, it } from 'vitest';
import { isSettledOf } from './isSettledOf';
import { settledAtOf } from './settledAtOf';
import type { SettleRequest } from './settleTypes';

const MERGED_AT = Date.parse('2026-10-06T09:00:00.000Z');

const merged = (mergedAt: number | null = MERGED_AT): SettleRequest => ({
  state: 'merged',
  mergedAt,
});
const open: SettleRequest = { state: 'open', mergedAt: null };
const closed: SettleRequest = { state: 'closed', mergedAt: null };
const unknown: SettleRequest = { state: 'unknown', mergedAt: null };

const none = { threads: [], agentStartedAts: [] };

describe('isSettledOf', () => {
  it.each([
    ['no request at all', []],
    ['an unknown request', [unknown]],
    ['one merged and one open', [merged(), open]],
    ['one merged and one unknown', [merged(), unknown]],
  ])('is not settled with %s', (_name, requests) => {
    expect(isSettledOf({ requests, ...none })).toBe(false);
  });

  it.each([
    ['one merged request', [merged()]],
    ['one closed request', [closed]],
    ['a merged and a closed request', [merged(), closed]],
  ])('is settled with %s', (_name, requests) => {
    expect(isSettledOf({ requests, ...none })).toBe(true);
  });

  it.each(['needs_answer', 'failed'])('is not settled while a thread is %s', (state) => {
    expect(isSettledOf({ requests: [merged()], threads: [{ state }], agentStartedAts: [] })).toBe(
      false,
    );
  });

  it('is settled when every thread is done', () => {
    expect(
      isSettledOf({
        requests: [merged()],
        threads: [{ state: 'resolved' }, { state: 'closed' }],
        agentStartedAts: [],
      }),
    ).toBe(true);
  });

  it('is not settled once an agent started after the merge', () => {
    expect(
      isSettledOf({ requests: [merged()], threads: [], agentStartedAts: [MERGED_AT + 1] }),
    ).toBe(false);
  });

  it('stays settled for agents that started before the merge', () => {
    expect(
      isSettledOf({ requests: [merged()], threads: [], agentStartedAts: [MERGED_AT - 1] }),
    ).toBe(true);
  });
});

describe('settledAtOf', () => {
  it('is the latest merge', () => {
    expect(settledAtOf({ requests: [merged(MERGED_AT), merged(MERGED_AT + 5)], threads: [] })).toBe(
      MERGED_AT + 5,
    );
  });

  it('ignores a closed request next to a merge', () => {
    expect(settledAtOf({ requests: [merged(), closed], threads: [] })).toBe(MERGED_AT);
  });

  it.each([
    ['only closed requests', [closed]],
    ['a merge with no known time', [merged(null)]],
    ['a merge and a request still open', [merged(), open]],
  ])('is unknown with %s', (_name, requests) => {
    expect(settledAtOf({ requests, threads: [] })).toBeNull();
  });
});
