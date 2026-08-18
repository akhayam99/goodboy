import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import { resolveMarkerState, type TimelineMarkerState } from './markerState';

type Row = {
  readonly status: Agent['status'];
  readonly hasOpenQuestion: boolean;
  readonly needsUser: boolean;
  readonly expected: TimelineMarkerState;
};

const TABLE: ReadonlyArray<Row> = [
  { status: 'completed', hasOpenQuestion: false, needsUser: false, expected: 'done' },
  { status: 'failed', hasOpenQuestion: false, needsUser: false, expected: 'failed' },
  { status: 'running', hasOpenQuestion: false, needsUser: false, expected: 'running' },
  { status: 'pending', hasOpenQuestion: false, needsUser: false, expected: 'pending' },
  { status: 'skipped', hasOpenQuestion: false, needsUser: false, expected: 'skipped' },
  { status: 'pending', hasOpenQuestion: false, needsUser: true, expected: 'needsUser' },
  { status: 'completed', hasOpenQuestion: true, needsUser: false, expected: 'question' },
];

describe('resolveMarkerState', () => {
  for (const row of TABLE) {
    it(`reads ${row.status} as ${row.expected}`, () => {
      expect(
        resolveMarkerState({
          status: row.status,
          hasOpenQuestion: row.hasOpenQuestion,
          needsUser: row.needsUser,
        }),
      ).toBe(row.expected);
    });
  }

  it('lets an open question outrank a running step, since the answer gates it', () => {
    expect(resolveMarkerState({ status: 'running', hasOpenQuestion: true, needsUser: false })).toBe(
      'question',
    );
  });

  it('keeps a running step running even when its run is otherwise blocked', () => {
    expect(resolveMarkerState({ status: 'running', hasOpenQuestion: false, needsUser: true })).toBe(
      'running',
    );
  });
});
