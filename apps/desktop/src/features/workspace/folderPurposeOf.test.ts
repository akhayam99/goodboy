// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FolderCodeMarker, FolderFileKind, FolderSignals } from '@goodboy/types';
import { folderPurposeOf } from './folderPurposeOf';

const NO_FILES: Readonly<Record<FolderFileKind, number>> = {
  markdown: 0,
  text: 0,
  pdf: 0,
  word: 0,
  pages: 0,
  keynote: 0,
  numbers: 0,
  excel: 0,
  powerpoint: 0,
  image: 0,
  video: 0,
  audio: 0,
  source: 0,
  other: 0,
};

type SignalsParams = {
  readonly markers?: ReadonlyArray<FolderCodeMarker>;
  readonly counts?: Partial<Record<FolderFileKind, number>>;
};

const signalsOf = ({ markers = [], counts = {} }: SignalsParams): FolderSignals => {
  const merged = { ...NO_FILES, ...counts };
  const totalFiles = Object.values(merged).reduce((total, count) => total + count, 0);
  return {
    path: '/Users/me/Documents/acme-notes',
    markers,
    counts: merged,
    totalFiles,
    totalBytes: totalFiles * 1024,
    entriesRead: totalFiles,
    isTruncated: false,
  };
};

type Row = readonly [string, SignalsParams, ReturnType<typeof folderPurposeOf>];

const ROWS: ReadonlyArray<Row> = [
  [
    'a package.json and 214 source files',
    { markers: ['package.json'], counts: { source: 214 } },
    'code',
  ],
  ['86 Markdown files and 12 PDFs', { counts: { markdown: 86, pdf: 12 } }, 'documents'],
  [
    'a manifest over many docs',
    { markers: ['Cargo.toml'], counts: { markdown: 300, source: 4 } },
    'code',
  ],
  ['an Xcode project alone', { markers: ['xcode'] }, 'code'],
  ['more source than documents', { counts: { source: 40, markdown: 3 } }, 'code'],
  ['640 files, most of them video', { counts: { video: 600, pdf: 40 } }, 'documents'],
  [
    'Office and iWork files',
    { counts: { word: 2, pages: 1, keynote: 1, numbers: 1, excel: 1, powerpoint: 1 } },
    'documents',
  ],
  ['an empty folder', {}, null],
  ['only files of no known kind', { counts: { other: 12 } }, null],
  ['a tie between source and documents', { counts: { source: 5, markdown: 3, text: 2 } }, null],
];

describe('folderPurposeOf', () => {
  it.each(ROWS)('reads %s', (_label, params, expected) => {
    expect(folderPurposeOf({ signals: signalsOf(params) })).toBe(expected);
  });
});
