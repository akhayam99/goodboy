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
};

const LUCIDE_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'lucide-react'/g;

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

  it('keeps every banned alias pointing at a spelling the registry or a feature really imports', () => {
    const corpus = SCANNED_ROOTS.flatMap((root) => listSourceFiles({ dir: root }))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const unused = Object.values(BANNED_ALIASES).filter((name) => !corpus.includes(name));
    expect(unused).toEqual([]);
  });
});
