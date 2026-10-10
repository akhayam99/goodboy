// @vitest-environment node
import { File, FileCode, FileLock } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { fileGlyphKindOf, fileGlyphOf, type FileGlyphKind } from './fileGlyph';

const CASES: ReadonlyArray<readonly [string, FileGlyphKind]> = [
  ['rounding.ts', 'code'],
  ['Button.tsx', 'code'],
  ['lib.rs', 'code'],
  ['Dockerfile', 'code'],
  ['Makefile', 'code'],
  ['package.json', 'data'],
  ['config.yaml', 'data'],
  ['Cargo.toml', 'data'],
  ['README.md', 'text'],
  ['brief.PDF', 'text'],
  ['notes.txt', 'text'],
  ['hero.png', 'image'],
  ['logo.svg', 'image'],
  ['settlement-batches.csv', 'sheet'],
  ['drift-summary.xlsx', 'sheet'],
  ['pnpm.lock', 'lock'],
  ['Cargo.lock', 'lock'],
  ['.env', 'lock'],
  ['.env.production', 'lock'],
  ['signing.pem', 'lock'],
  ['backup.zip', 'archive'],
  ['release.tar', 'archive'],
  ['LICENSE', 'generic'],
  ['archive.unknownext', 'generic'],
  ['trailing.', 'generic'],
  ['', 'generic'],
];

describe('fileGlyphKindOf', () => {
  it.each(CASES)('%s is %s', (name, kind) => {
    expect(fileGlyphKindOf({ name })).toBe(kind);
  });

  it('reads the extension case-insensitively and only after the last dot', () => {
    expect(fileGlyphKindOf({ name: 'Report.Final.XLSX' })).toBe('sheet');
    expect(fileGlyphKindOf({ name: 'archive.tar.gz' })).toBe('archive');
  });
});

describe('fileGlyphOf', () => {
  it('returns one icon per kind', () => {
    expect(fileGlyphOf({ name: 'rounding.ts' })).toBe(FileCode);
    expect(fileGlyphOf({ name: '.env' })).toBe(FileLock);
    expect(fileGlyphOf({ name: 'LICENSE' })).toBe(File);
  });
});
