import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import {
  ancestorIds,
  buildChangeTree,
  defaultCollapsed,
  filterFiles,
  orderLikeTree,
  visibleRows,
} from './changeTree';
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

    expect(folders).toEqual([
      'dir:docs',
      'dir:src',
      'dir:src/ledger',
      'dir:src/ledger/export',
      'dir:src/types',
    ]);
    const types = rows.find((row) => row.id === 'dir:src/types');
    expect(types).toMatchObject({ kind: 'folder', label: 'types', depth: 1 });
  });

  it('compacts a chain of folders that only hold a folder', () => {
    const { rows } = buildChangeTree({
      files: [fileAt('apps/desktop/src/a.ts'), fileAt('apps/desktop/src/b.ts')],
    });

    expect(rows[0]).toMatchObject({
      kind: 'folder',
      id: 'dir:apps/desktop/src',
      label: 'apps/desktop/src',
      depth: 0,
      fileCount: 2,
    });
  });

  it('puts folders before files, alphabetical, and files follow the same order', () => {
    const { rows, files } = buildChangeTree({ files: SAMPLE });

    expect(rows.map((row) => row.id)).toEqual([
      'dir:docs',
      'docs/export.md',
      'dir:src',
      'dir:src/ledger',
      'dir:src/ledger/export',
      'src/ledger/export/buildCsv.ts',
      'src/ledger/export/csv.ts',
      'src/ledger/export/page.tsx',
      'src/ledger/ledger.ts',
      'dir:src/types',
      'src/types/ledger.ts',
      'package.json',
    ]);
    expect(files.map((file) => file.path)).toEqual(
      rows.filter((row) => row.kind === 'file').map((row) => row.id),
    );
  });

  it('sums additions, deletions and file counts up the folders', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const src = rows.find((row) => row.id === 'dir:src');
    const exportDir = rows.find((row) => row.id === 'dir:src/ledger/export');

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

  it('keeps every one of 500 files once', () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      fileAt(`pkg${index % 12}/src/mod${index % 40}/file${index}.ts`),
    );
    const tree = buildChangeTree({ files: many });

    expect(tree.files).toHaveLength(500);
    expect(tree.rows.filter((row) => row.kind === 'file')).toHaveLength(500);
  });
});

describe('visibleRows', () => {
  it('hides everything under a collapsed folder and nothing else', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });
    const visible = visibleRows({ rows, collapsed: new Set(['dir:src/ledger']) });

    expect(visible.map((row) => row.id)).toEqual([
      'dir:docs',
      'docs/export.md',
      'dir:src',
      'dir:src/ledger',
      'dir:src/types',
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
      'dir:src/ledger/export',
      'dir:src/ledger',
      'dir:src',
    ]);
    expect(ancestorIds({ rows, path: 'package.json' })).toEqual([]);
  });
});

describe('buildChangeTree groups', () => {
  const MIXED = [
    ...SAMPLE,
    fileAt('pnpm-lock.yaml', { additions: 300, deletions: 80 }),
    fileAt('dist/bundle.js'),
    fileAt('test/ledger/buildCsv.test.ts'),
  ];

  it('moves generated files out of the folders into one row at the bottom', () => {
    const { rows, files } = buildChangeTree({ files: MIXED });
    const last = rows.filter((row) => row.kind === 'folder').at(-1);

    expect(last).toMatchObject({
      id: 'group:generated',
      label: 'Generated',
      fileCount: 2,
      additions: 302,
      deletions: 81,
      depth: 0,
    });
    expect(rows.find((row) => row.id === 'dir:dist')).toBeUndefined();
    expect(files.slice(-2).map((file) => file.path)).toEqual(['dist/bundle.js', 'pnpm-lock.yaml']);
  });

  it('groups by kind in a fixed order with the folder kept beside each name', () => {
    const { rows } = buildChangeTree({ files: MIXED, group: 'kind' });

    expect(rows.filter((row) => row.kind === 'folder').map((row) => row.label)).toEqual([
      'Source',
      'Tests',
      'Config',
      'Docs',
      'Generated',
    ]);
    const csv = rows.find((row) => row.id === 'src/ledger/export/csv.ts');
    expect(csv).toMatchObject({
      kind: 'file',
      depth: 1,
      dir: 'src/ledger/export',
      parentId: 'group:source',
    });
  });

  it('leaves out kinds that have no file', () => {
    const { rows } = buildChangeTree({ files: [fileAt('src/a.ts')], group: 'kind' });

    expect(rows.filter((row) => row.kind === 'folder').map((row) => row.label)).toEqual(['Source']);
  });

  it('keeps no folder dir on rows in the folder grouping', () => {
    const { rows } = buildChangeTree({ files: SAMPLE });

    expect(rows.filter((row) => row.kind === 'file').every((row) => row.dir === null)).toBe(true);
  });
});

describe('filterFiles', () => {
  it('keeps the order of the files and matches a subsequence of the path', () => {
    const out = filterFiles({ files: SAMPLE, query: 'exp' });

    expect(out.map((file) => file.path)).toEqual([
      'src/ledger/export/page.tsx',
      'src/ledger/export/buildCsv.ts',
      'src/ledger/export/csv.ts',
      'docs/export.md',
    ]);
  });

  it('returns the same list for an empty or blank query', () => {
    expect(filterFiles({ files: SAMPLE, query: '  ' })).toBe(SAMPLE);
  });

  it('is case insensitive and finds nothing for an unrelated query', () => {
    expect(filterFiles({ files: SAMPLE, query: 'BUILDCSV' })).toHaveLength(1);
    expect(filterFiles({ files: SAMPLE, query: 'zzz' })).toEqual([]);
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

    expect([...defaultCollapsed({ tree })].sort()).toEqual(['dir:big', 'dir:mid']);
  });

  it('keeps a parent open when a folder inside it is the big one', () => {
    const tree = buildChangeTree({
      files: [
        ...many('apps/web/components', 260),
        ...many('apps/web/routes', 30),
        ...many('docs', 20),
      ],
    });

    expect([...defaultCollapsed({ tree })]).toEqual(['dir:apps/web/components']);
  });

  it('starts with the Generated row closed, whatever the size of the change', () => {
    const tree = buildChangeTree({ files: [fileAt('src/a.ts'), fileAt('pnpm-lock.yaml')] });

    expect([...defaultCollapsed({ tree })]).toEqual(['group:generated']);
  });
});

describe('folder row ids', () => {
  it('never share an id with a file that has the same path', () => {
    const { rows } = buildChangeTree({
      files: [fileAt('docs', { status: 'deleted' }), fileAt('docs/readme.md', { status: 'added' })],
    });
    const ids = rows.map((row) => row.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['dir:docs', 'docs/readme.md', 'docs']);
  });

  it('point the children of a folder at its prefixed id', () => {
    const { rows } = buildChangeTree({ files: [fileAt('src/a/b.ts'), fileAt('src/a/c/d.ts')] });

    expect(rows.find((row) => row.id === 'src/a/b.ts')?.parentId).toBe('dir:src/a');
    expect(rows.find((row) => row.id === 'dir:src/a/c')?.parentId).toBe('dir:src/a');
  });
});

describe('orderLikeTree', () => {
  const NAMES = [
    'a',
    'A',
    'b',
    'B',
    'a.b',
    'a-b',
    'a_b',
    '_a',
    '.a',
    '-a',
    '1',
    '10',
    '2',
    'é',
    'Z',
    'z',
    'Src',
    'index.ts',
    'Index.ts',
    'README.md',
    'readme.md',
    '__tests__',
    '[id]',
    '(auth)',
    '@modal',
    'x y',
  ];

  const seeded = (seed: number) => {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  const pathSets = (count: number): ReadonlyArray<ReadonlyArray<string>> => {
    const random = seeded(18);
    const pick = () => NAMES[Math.floor(random() * NAMES.length)] ?? 'a';
    return Array.from({ length: count }, () => {
      const size = 1 + Math.floor(random() * 40);
      const paths = new Set<string>();
      for (let index = 0; index < size; index += 1) {
        const depth = 1 + Math.floor(random() * 4);
        paths.add(Array.from({ length: depth }, pick).join('/'));
      }
      return [...paths];
    });
  };

  const oracle = (paths: ReadonlyArray<string>, depth: number): ReadonlyArray<string> => {
    const dirs = new Map<string, string[]>();
    const leaves: string[] = [];
    for (const path of paths) {
      const parts = path.split('/');
      if (parts.length - 1 === depth) {
        leaves.push(path);
        continue;
      }
      const key = parts[depth] ?? '';
      dirs.set(key, [...(dirs.get(key) ?? []), path]);
    }
    const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
    return [
      ...[...dirs.keys()]
        .sort((left, right) => left.localeCompare(right))
        .flatMap((key) => oracle(dirs.get(key) ?? [], depth + 1)),
      ...leaves.sort((left, right) => nameOf(left).localeCompare(nameOf(right))),
    ];
  };

  const SETS = pathSets(300);

  it('lists the files in the order of the rows, for every grouping', () => {
    for (const paths of SETS) {
      for (const group of ['folders', 'kind'] as const) {
        const tree = buildChangeTree({ files: paths.map((path) => fileAt(path)), group });

        expect(tree.files.map((file) => file.path)).toEqual(
          tree.rows.filter((row) => row.kind === 'file').map((row) => row.id),
        );
      }
    }
  });

  it('matches an independent recursive sort: folders first, then files, by name', () => {
    for (const paths of SETS) {
      const ordered = orderLikeTree({ files: paths.map((path) => fileAt(path)) });

      expect(ordered.map((file) => file.path)).toEqual(oracle(paths, 0));
    }
  });

  it('is idempotent and does not depend on the order it is given', () => {
    const random = seeded(7);
    for (const paths of SETS) {
      const files = paths.map((path) => fileAt(path));
      const once = orderLikeTree({ files });
      const shuffled = [...files].sort(() => random() - 0.5);

      expect(orderLikeTree({ files: once }).map((file) => file.path)).toEqual(
        once.map((file) => file.path),
      );
      expect(orderLikeTree({ files: shuffled }).map((file) => file.path)).toEqual(
        once.map((file) => file.path),
      );
    }
  });

  it('keeps each file once and has no repeated row id', () => {
    for (const paths of SETS) {
      const { rows, files } = buildChangeTree({ files: paths.map((path) => fileAt(path)) });
      const ids = rows.map((row) => row.id);

      expect(files).toHaveLength(paths.length);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('sorts a git order with renames the way the tree shows it', () => {
    const raw = [
      fileAt('web/z.ts'),
      fileAt('api/new.ts', { status: 'renamed', oldPath: 'web/old.ts' }),
      fileAt('README.md'),
      fileAt('api/a.ts'),
    ];

    expect(orderLikeTree({ files: raw }).map((file) => file.path)).toEqual([
      'api/a.ts',
      'api/new.ts',
      'web/z.ts',
      'README.md',
    ]);
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
