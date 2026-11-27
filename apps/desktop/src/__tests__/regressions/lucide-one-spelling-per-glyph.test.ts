// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const SCANNED_ROOTS = [DESKTOP_SRC, join(REPO_ROOT, 'packages', 'ui', 'src')];
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);

const BANNED_ALIASES: Readonly<Record<string, string>> = {
  AlertTriangle: 'TriangleAlert',
  AlertCircle: 'CircleAlert',
  XCircle: 'CircleX',
  CheckCircle2: 'CircleCheck',
  ExternalLink: 'SquareArrowOutUpRight',
  PenLine: 'Pencil',
  PencilLine: 'Pencil',
};

const LUCIDE_IMPORT =
  /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'(?:@goodboy\/ui\/|(?:\.{1,2}\/)+)icons'/g;

const RESERVED_GLYPHS: Readonly<
  Record<string, { readonly reason: string; readonly homes: ReadonlyArray<string> }>
> = {
  RotateCw: {
    reason: 'one clockwise arrow is the browser reload, every other refresh draws RefreshCw',
    homes: ['apps/desktop/src/features/browser/'],
  },
  ScrollText: {
    reason: 'scripts draw ListVideo, a log or a transcript may draw the scroll',
    homes: [
      'apps/desktop/src/features/actions/kinds/pullRequest.ts',
      'apps/desktop/src/features/actions/kinds/workflowRun.ts',
      'apps/desktop/src/shared/utils/verbs.ts',
    ],
  },
};

type ListParams = {
  readonly dir: string;
  readonly acc?: string[];
};

const listSourceFiles = ({ dir, acc = [] }: ListParams): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles({ dir: full, acc });
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
};

type NamesParams = {
  readonly source: string;
};

const importedNamesOf = ({ source }: NamesParams): string[] =>
  [...source.matchAll(LUCIDE_IMPORT)].flatMap((match) =>
    (match[1] ?? '').split(',').map((raw) => raw.trim().split(/\s+as\s+/)[0] ?? ''),
  );

type BannedParams = {
  readonly source: string;
};

const bannedImportsOf = ({ source }: BannedParams): string[] => {
  const found: string[] = [];
  for (const match of source.matchAll(LUCIDE_IMPORT)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0] ?? '';
      if (name in BANNED_ALIASES) {
        found.push(name);
      }
    }
  }
  return found;
};

describe('lucide spellings', () => {
  it('imports one spelling per glyph: the registry spelling, never an alias', () => {
    const offenders: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of listSourceFiles({ dir: root })) {
        const path = relative(REPO_ROOT, file).split(sep).join('/');
        for (const name of bannedImportsOf({ source: readFileSync(file, 'utf8') })) {
          offenders.push(`${path} imports ${name}, use ${BANNED_ALIASES[name]}`);
        }
      }
    }
    expect(
      offenders,
      `A glyph has one import spelling (the one conceptIcons.ts uses). Rename in:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps a reserved glyph inside the homes that own its meaning', () => {
    const offenders: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of listSourceFiles({ dir: root })) {
        const path = relative(REPO_ROOT, file).split(sep).join('/');
        for (const name of importedNamesOf({ source: readFileSync(file, 'utf8') })) {
          const reserved = RESERVED_GLYPHS[name];
          if (reserved !== undefined && !reserved.homes.some((home) => path.startsWith(home))) {
            offenders.push(`${path} imports ${name}: ${reserved.reason}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every banned alias pointing at a spelling the registry or a feature really imports', () => {
    const corpus = SCANNED_ROOTS.flatMap((root) => listSourceFiles({ dir: root }))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const unused = Object.values(BANNED_ALIASES).filter((name) => !corpus.includes(name));
    expect(unused).toEqual([]);
  });
});
