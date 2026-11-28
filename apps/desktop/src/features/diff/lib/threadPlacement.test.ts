import { describe, expect, it } from 'vitest';
import type { DiffHunk } from '@goodboy/types';
import type { DiffThread } from '../components/DiffView/types';
import { placeThreads } from './threadPlacement';

const HUNKS: ReadonlyArray<DiffHunk> = [
  {
    header: '@@ -10,3 +10,4 @@',
    oldStart: 10,
    oldLines: 3,
    newStart: 10,
    newLines: 4,
    lines: [
      { kind: 'context', oldLine: 10, newLine: 10, text: 'export const LedgerRow = () => {' },
      { kind: 'del', oldLine: 11, newLine: null, text: '  return null;' },
      { kind: 'add', oldLine: null, newLine: 11, text: '  const label = format(row);' },
    ],
  },
];

type ThreadParams = {
  readonly id: string;
  readonly source: DiffThread['source'];
  readonly line: number | null;
  readonly isOutdated?: boolean;
};

const threadOf = ({ id, source, line, isOutdated }: ThreadParams): DiffThread => ({
  id,
  filePath: 'ledger-core/src/LedgerRow.tsx',
  anchor: line === null ? null : { side: 'new', lineNumber: line },
  body: 'Cap the retries at three.',
  tone: 'neutral',
  author: 'Maya Ortiz',
  isAgent: false,
  source,
  host: source === 'host' ? 'github' : null,
  createdAt: '2026-10-10T09:00:00.000Z',
  statusLabel: 'Open',
  isResolved: false,
  canEdit: false,
  canClose: false,
  canReopen: false,
  ...(isOutdated === undefined ? {} : { isOutdated }),
});

describe('placeThreads', () => {
  it('keeps a thread on its line while the line is in the diff', () => {
    const placed = placeThreads({
      threads: [threadOf({ id: 'a', source: 'host', line: 11 })],
      hunks: HUNKS,
      isBodyLoaded: true,
    });

    expect(placed.onLines.map((thread) => thread.id)).toEqual(['a']);
    expect(placed.outdated).toEqual([]);
  });

  it('moves a host thread whose line left the diff to the outdated group', () => {
    const placed = placeThreads({
      threads: [threadOf({ id: 'a', source: 'host', line: 42 })],
      hunks: HUNKS,
      isBodyLoaded: true,
    });

    expect(placed.outdated.map((thread) => thread.id)).toEqual(['a']);
    expect(placed.onLines).toEqual([]);
  });

  it('waits for the file body before it calls a line gone', () => {
    const placed = placeThreads({
      threads: [threadOf({ id: 'a', source: 'host', line: 42 })],
      hunks: [],
      isBodyLoaded: false,
    });

    expect(placed.onLines.map((thread) => thread.id)).toEqual(['a']);
  });

  it('puts a thread the host marks outdated in the outdated group, with or without a line', () => {
    const placed = placeThreads({
      threads: [
        threadOf({ id: 'a', source: 'host', line: 11, isOutdated: true }),
        threadOf({ id: 'b', source: 'host', line: null, isOutdated: true }),
      ],
      hunks: HUNKS,
      isBodyLoaded: true,
    });

    expect(placed.outdated.map((thread) => thread.id)).toEqual(['a', 'b']);
  });

  it('leaves a note on a context line it drew itself and a whole-file thread on the file', () => {
    const placed = placeThreads({
      threads: [
        threadOf({ id: 'note', source: 'note', line: 42 }),
        threadOf({ id: 'file', source: 'host', line: null }),
      ],
      hunks: HUNKS,
      isBodyLoaded: true,
    });

    expect(placed.onLines.map((thread) => thread.id)).toEqual(['note']);
    expect(placed.onFile.map((thread) => thread.id)).toEqual(['file']);
  });
});
