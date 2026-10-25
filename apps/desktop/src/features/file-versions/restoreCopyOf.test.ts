import { describe, expect, it } from 'vitest';
import { restoreCopyOf } from './restoreCopyOf';
import type { RestoreOutcome, RestoreTarget } from './useChangesRestore';

const target = (patch: Partial<RestoreTarget>): RestoreTarget => ({
  id: 'turn:run-1',
  scope: 'turn',
  runId: 'run-1',
  fileKey: null,
  subject: 'turn 3',
  turnNumber: 3,
  isNewFile: false,
  steps: [],
  ...patch,
});

const ask = (
  patch: Partial<RestoreTarget>,
  otherWriters: ReadonlyArray<string>,
): RestoreOutcome => ({
  kind: 'ask',
  target: target(patch),
  changedSince: ['pricing.md'],
  otherWriters,
});

describe('restoreCopyOf', () => {
  it('names the other agent in the question that already exists', () => {
    const copy = restoreCopyOf({ outcome: ask({}, ['Scout']) });

    expect(copy.title).toBe('pricing.md changed after turn 3.');
    expect(copy.body).toBe(
      'Scout wrote there after turn 3. Your current text is saved as a version before the turn goes back.',
    );
    expect(copy.confirm).toBe('Restore anyway');
  });

  it('names two agents with and, for a file as well as for a turn', () => {
    const copy = restoreCopyOf({
      outcome: ask({ scope: 'file', subject: 'pricing.md' }, ['Scout', 'Reviewer']),
    });

    expect(copy.body).toBe(
      'Scout and Reviewer wrote there after turn 3. Your current text is saved as a version before it goes back.',
    );
  });

  it('keeps the question as it was when nobody else wrote there', () => {
    expect(restoreCopyOf({ outcome: ask({}, []) }).body).toBe(
      'Your current text is saved as a version before the turn goes back.',
    );
  });
});
