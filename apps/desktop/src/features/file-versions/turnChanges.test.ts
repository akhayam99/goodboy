import { describe, expect, it } from 'vitest';
import { testTurn } from './testing/testTurn';
import { turnChanges } from './turnChanges';

describe('turnChanges', () => {
  it('counts each file once over the turns that changed it, and leaves restores out', () => {
    const turns = [
      testTurn({
        runId: 'turn-3',
        changes: [{ relativePath: 'launch-memo.md' }, { relativePath: 'faq.md' }],
      }),
      testTurn({
        runId: 'turn-2',
        changes: [{ relativePath: 'interviews/summary.md', change: 'added' }],
      }),
      testTurn({
        runId: 'turn-1',
        changes: [
          { relativePath: 'launch-memo.md' },
          { relativePath: 'pricing.md', change: 'deleted' },
        ],
      }),
      testTurn({
        runId: 'restore-1',
        kind: 'restore',
        restoresRunId: 'turn-1',
        changes: [{ relativePath: 'pricing.md', change: 'added' }],
      }),
      testTurn({ runId: 'turn-empty', changes: [] }),
    ];

    expect(turnChanges({ turns })).toEqual({
      fileCount: 4,
      turnCount: 3,
      addedCount: 1,
      modifiedCount: 3,
      deletedCount: 1,
    });
  });

  it('keeps the same path in two folders apart', () => {
    const turns = [
      testTurn({ runId: 'turn-1', changes: [{ relativePath: 'plan.md' }] }),
      testTurn({
        runId: 'turn-1',
        folderPath: '/Users/dana/Documents/acme-research',
        changes: [{ relativePath: 'plan.md' }],
      }),
    ];

    expect(turnChanges({ turns }).fileCount).toBe(2);
  });
});
