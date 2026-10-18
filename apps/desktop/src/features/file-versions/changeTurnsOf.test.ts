import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { changeTurnsOf } from './changeTurnsOf';
import { folderChangeKey } from './folderChangeKey';
import { testTurn } from './testing/testTurn';
import { turnTitlesOf } from './turnTitlesOf';

const NOTES = '/mock/Documents/acme-notes';

describe('changeTurnsOf', () => {
  it('numbers the writing turns oldest first and lists them newest first, without restores', () => {
    const turns = [
      testTurn({
        runId: 'restore-1',
        kind: 'restore',
        restoresRunId: 'run-1',
        finishedAtMs: 40,
        folderPath: NOTES,
        changes: [{ relativePath: 'pricing.md' }],
      }),
      testTurn({
        runId: 'run-3',
        finishedAtMs: 30,
        folderPath: NOTES,
        changes: [{ relativePath: 'launch-memo.md' }],
      }),
      testTurn({ runId: 'run-empty', finishedAtMs: 25, folderPath: NOTES, changes: [] }),
      testTurn({
        runId: 'run-2',
        finishedAtMs: 20,
        folderPath: NOTES,
        changes: [{ relativePath: 'interviews/summary.md', change: 'added' }],
      }),
      testTurn({
        runId: 'run-1',
        finishedAtMs: 10,
        folderPath: NOTES,
        changes: [{ relativePath: 'pricing.md' }],
      }),
    ];
    const restoredKey = folderChangeKey({
      folderPath: NOTES,
      runId: 'run-1',
      relativePath: 'pricing.md',
    });

    const result = changeTurnsOf({
      turns,
      restored: { [restoredKey]: 'restore-1' },
      titles: { 'run-3': 'Tighten the intro' },
    });

    expect(result.map((turn) => [turn.number, turn.runId, turn.title])).toEqual([
      [3, 'run-3', 'Tighten the intro'],
      [2, 'run-2', null],
      [1, 'run-1', null],
    ]);
    expect(result[2]?.files[0]?.restoreRunId).toBe('restore-1');
    expect(result[1]?.files[0]?.change).toBe('added');
  });

  it('names the folder on each file when the session writes in two folders', () => {
    const result = changeTurnsOf({
      turns: [
        testTurn({ runId: 'run-1', folderPath: NOTES, changes: [{ relativePath: 'faq.md' }] }),
        testTurn({
          runId: 'run-1',
          folderPath: '/mock/Code/acme-web',
          changes: [{ relativePath: 'README.md' }],
        }),
      ],
      restored: {},
      titles: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.files.map((file) => file.label)).toEqual([
      'acme-notes/faq.md',
      'acme-web/README.md',
    ]);
  });
});

describe('turnTitlesOf', () => {
  it('takes the first line the person wrote for each turn', () => {
    const titles = turnTitlesOf({
      transcripts: [
        [
          {
            kind: 'user_text',
            runId: brandId<ProviderRunId>({ value: 'run-3' }),
            text: '\nTighten the intro\nand the FAQ',
            at: brandId<IsoDateTime>({ value: '2026-10-17T09:00:00.000Z' }),
          },
        ],
      ],
    });
    expect(titles).toEqual({ 'run-3': 'Tighten the intro' });
  });
});
