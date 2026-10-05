import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { ancestorIds, buildChangeTree, defaultCollapsed, visibleRows } from './changeTree';
import { fileKindOf } from './fileStatus';

const fileAt = (path: string, extra: Partial<FileDiff> = {}): FileDiff => ({
  path,
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [],
  ...extra,
});

const SAMPLE = [
  fileAt('package.json'),
  fileAt('src/ledger/export/page.tsx'),
  fileAt('src/ledger/export/buildCsv.ts', { status: 'added', additions: 10, deletions: 0 }),
  fileAt('src/ledger/ledger.ts'),
  fileAt('src/ledger/export/csv.ts', { status: 'renamed', oldPath: 'src/ledger/csv.ts' }),
  fileAt('src/types/ledger.ts'),
  fileAt('docs/export.md', { status: 'added' }),
];

describe('buildChangeTree', () => {
  it('merges single-child folder chains into one row', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const folders = rows.filter((row) => row.kind === 'folder').map((row) => row.id);

    expect(folders).toEqual(['docs', 'src', 'src/ledger', 'src/ledger/export', 'src/types']);
    const types = rows.find((row) => row.id === 'src/types');
    expect(types).toMatchObject({ kind: 'folder', label: 'types', depth: 1 });
  });

  it('compacts a chain of folders that only hold a folder', () => {
    const { rows } = buildChangeTree({
      files: [fileAt('apps/desktop/src/a.ts'), fileAt('apps/desktop/src/b.ts')],
    });

    expect(rows[0]).toMatchObject({
      kind: 'folder',
      id: 'apps/desktop/src',
      label: 'apps/desktop/src',
      depth: 0,
      fileCount: 2,
    });
  });

  it('puts folders before files, alphabetical, and files follow the same order', () => {
    const { rows, files } = buildChangeTree({ files: SAMPLE });

    expect(rows.map((row) => row.id)).toEqual([
      'docs',
      'docs/export.md',
      'src',
      'src/ledger',
      'src/ledger/export',
      'src/ledger/export/buildCsv.ts',
      'src/ledger/export/csv.ts',
      'src/ledger/export/page.tsx',
      'src/ledger/ledger.ts',
      'src/types',
      'src/types/ledger.ts',
      'package.json',
    ]);
    expect(files.map((file) => file.path)).toEqual(
      rows.filter((row) => row.kind === 'file').map((row) => row.id),
    );
  });

  it('sums additions, deletions and file counts up the folders', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const src = rows.find((row) => row.id === 'src');
    const exportDir = rows.find((row) => row.id === 'src/ledger/export');

    expect(src).toMatchObject({ kind: 'folder', fileCount: 5, additions: 18, deletions: 4 });
    expect(exportDir).toMatchObject({ kind: 'folder', fileCount: 3, additions: 14, deletions: 2 });
    expect(src?.kind === 'folder' ? src.paths : []).toContain('src/types/ledger.ts');
  });

  it('keeps the old path of a rename and the kind of every file', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const renamed = rows.find((row) => row.id === 'src/ledger/export/csv.ts');
    const doc = rows.find((row) => row.id === 'docs/export.md');

    expect(renamed).toMatchObject({ kind: 'file', fromPath: 'src/ledger/csv.ts', name: 'csv.ts' });
    expect(doc).toMatchObject({ kind: 'file', fileKind: 'docs' });
  });

  it('returns nothing for no files', () => {
    expect(buildChangeTree({ files: [] })).toEqual({ rows: [], files: [] });
  });

  it('builds 500 files in under 5ms of work per run on average', () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      fileAt(`pkg${index % 12}/src/mod${index % 40}/file${index}.ts`),
    );
    buildChangeTree({ files: many });
    const start = performance.now();
    for (let run = 0; run < 10; run += 1) {
      buildChangeTree({ files: many });
    }
    expect((performance.now() - start) / 10).toBeLessThan(5);
  });
});

describe('visibleRows', () => {
  it('hides everything under a collapsed folder and nothing else', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const visible = visibleRows({ rows, collapsed: new Set(['src/ledger']) });

    expect(visible.map((row) => row.id)).toEqual([
      'docs',
      'docs/export.md',
      'src',
      'src/ledger',
      'src/types',
      'src/types/ledger.ts',
      'package.json',
    ]);
  });

  it('returns every row when nothing is collapsed', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });

    expect(visibleRows({ rows, collapsed: new Set() })).toBe(rows);
  });
});

describe('ancestorIds', () => {
  it('lists the folders above a file, nearest first', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });

    expect(ancestorIds({ rows, path: 'src/ledger/export/page.tsx' })).toEqual([
      'src/ledger/export',
      'src/ledger',
      'src',
    ]);
    expect(ancestorIds({ rows, path: 'package.json' })).toEqual([]);
  });
});

describe('defaultCollapsed', () => {
  const many = (folder: string, count: number) =>
    Array.from({ length: count }, (_, index) => fileAt(`${folder}/f${index}.ts`));

  it('keeps everything open up to 300 files', () => {
    const tree = buildChangeTree({ files: [...many('big', 120), ...many('also', 120)] });

    expect(defaultCollapsed({ tree }).size).toBe(0);
  });

  it('closes the folders over 50 files once the change passes 300', () => {
    const tree = buildChangeTree({
      files: [...many('big', 260), ...many('mid', 51), ...many('small', 49)],
    });

    expect([...defaultCollapsed({ tree })].sort()).toEqual(['big', 'mid']);
  });

  it('keeps a parent open when a folder inside it is the big one', () => {
    const tree = buildChangeTree({
      files: [
        ...many('apps/web/components', 260),
        ...many('apps/web/routes', 30),
        ...many('docs', 20),
      ],
    });

    expect([...defaultCollapsed({ tree })]).toEqual(['apps/web/components']);
  });
});

describe('fileKindOf', () => {
  it('classifies paths by kind, generated first', () => {
    expect(fileKindOf('pnpm-lock.yaml')).toBe('generated');
    expect(fileKindOf('src/__generated__/graphql.ts')).toBe('generated');
    expect(fileKindOf('test/ledger/buildCsv.test.ts')).toBe('test');
    expect(fileKindOf('src/ledger/ledger.spec.ts')).toBe('test');
    expect(fileKindOf('docs/export.md')).toBe('docs');
    expect(fileKindOf('package.json')).toBe('config');
    expect(fileKindOf('.env.example')).toBe('config');
    expect(fileKindOf('vite.config.ts')).toBe('config');
    expect(fileKindOf('src/ledger/ledger.ts')).toBe('source');
  });
});
