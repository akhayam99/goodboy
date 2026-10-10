// @vitest-environment node
import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileJson,
  FileLock,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { fileGlyphOf } from './fileGlyph';

const CASES: ReadonlyArray<readonly [string, LucideIcon]> = [
  ['rounding.ts', FileCode],
  ['Button.tsx', FileCode],
  ['lib.rs', FileCode],
  ['Dockerfile', FileCode],
  ['Makefile', FileCode],
  ['package.json', FileJson],
  ['config.yaml', FileJson],
  ['Cargo.toml', FileJson],
  ['README.md', FileText],
  ['brief.PDF', FileText],
  ['notes.txt', FileText],
  ['hero.png', FileImage],
  ['logo.svg', FileImage],
  ['settlement-batches.csv', FileSpreadsheet],
  ['drift-summary.xlsx', FileSpreadsheet],
  ['pnpm.lock', FileLock],
  ['Cargo.lock', FileLock],
  ['.env', FileLock],
  ['.env.production', FileLock],
  ['signing.pem', FileLock],
  ['backup.zip', FileArchive],
  ['release.tar', FileArchive],
  ['LICENSE', File],
  ['archive.unknownext', File],
  ['trailing.', File],
  ['', File],
];

describe('fileGlyphOf', () => {
  it.each(CASES)('%s gets its own glyph', (name, icon) => {
    expect(fileGlyphOf({ name })).toBe(icon);
  });

  it('reads the extension case-insensitively and only after the last dot', () => {
    expect(fileGlyphOf({ name: 'Report.Final.XLSX' })).toBe(FileSpreadsheet);
    expect(fileGlyphOf({ name: 'archive.tar.gz' })).toBe(FileArchive);
  });
});
