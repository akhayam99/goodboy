import { describe, expect, it } from 'vitest';
import { folderChangeKey } from './folderChangeKey';
import { restoredChanges } from './restoredChanges';
import { testTurn } from './testing/testTurn';

const FOLDER = '/Users/dana/Documents/acme-notes';

const memoOf = ({ runId }: { readonly runId: string }) =>
  folderChangeKey({ folderPath: FOLDER, runId, relativePath: 'launch-memo.md' });

describe('restoredChanges', () => {
  const turn = testTurn({
    runId: 'turn-3',
    finishedAtMs: 10,
    changes: [{ relativePath: 'launch-memo.md' }, { relativePath: 'faq.md' }],
  });
  const restore = testTurn({
    runId: 'restore-1',
    kind: 'restore',
    restoresRunId: 'turn-3',
    finishedAtMs: 20,
    changes: [{ relativePath: 'launch-memo.md' }],
  });
  const undo = testTurn({
    runId: 'undo-1',
    kind: 'restore',
    restoresRunId: 'restore-1',
    finishedAtMs: 30,
    changes: [{ relativePath: 'launch-memo.md' }],
  });
  const undoOfUndo = testTurn({
    runId: 'undo-2',
    kind: 'restore',
    restoresRunId: 'undo-1',
    finishedAtMs: 40,
    changes: [{ relativePath: 'launch-memo.md' }],
  });

  it('marks a restored file with the restore that did it', () => {
    const restored = restoredChanges({ turns: [restore, turn] });

    expect(restored[memoOf({ runId: 'turn-3' })]).toBe('restore-1');
    expect(
      restored[folderChangeKey({ folderPath: FOLDER, runId: 'turn-3', relativePath: 'faq.md' })],
    ).toBeUndefined();
  });

  it('clears the mark after Undo restore, and brings it back when the undo is undone', () => {
    expect(
      restoredChanges({ turns: [undo, restore, turn] })[memoOf({ runId: 'turn-3' })],
    ).toBeUndefined();
    expect(
      restoredChanges({ turns: [undoOfUndo, undo, restore, turn] })[memoOf({ runId: 'turn-3' })],
    ).toBe('restore-1');
  });
});
