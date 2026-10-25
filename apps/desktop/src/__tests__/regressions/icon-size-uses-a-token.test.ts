// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');
const SCANNED_ROOTS = [
  { base: DESKTOP_SRC, prefix: 'apps/desktop/src', dirs: ['features', 'app', 'shared'] },
  { base: UI_SRC, prefix: 'packages/ui/src', dirs: ['.'] },
];
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);

const LITERAL = '(?:1[0-8])';
const TOKENIZED_SIZE = new RegExp(
  [
    `\\bsize=\\{${LITERAL}\\}`,
    `\\b[iI]conSize\\s*=\\s*${LITERAL}\\b`,
    `\\bsize\\s*=\\s*${LITERAL}\\b`,
    `\\b(?:[iI]conSize|size)\\s*\\?\\?\\s*${LITERAL}\\b`,
    `\\bsize=\\{[^}]*[?:]\\s*${LITERAL}\\b`,
    `\\bsize === [^?]+\\? ${LITERAL} : ${LITERAL}\\b`,
  ].join('|'),
);
const TOKENIZED_RANGE = '10 to 18';

type Exception = {
  readonly path: string;
  readonly reason: string;
};

const ALLOWLIST: ReadonlyArray<Exception> = [
  {
    path: 'apps/desktop/src/features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
    reason: 'the literal is the HTML input size attribute in characters, not an icon size',
  },
];

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
    const isSource = entry.endsWith('.tsx') || entry.endsWith('.ts');
    if (isSource && !entry.includes('.test.') && !entry.includes('.stories.')) {
      acc.push(full);
    }
  }
  return acc;
};

type AllowedParams = {
  readonly path: string;
};

const isAllowed = ({ path }: AllowedParams): boolean =>
  ALLOWLIST.some((entry) => path === entry.path || path.startsWith(`${entry.path}/`));

describe('icon sizing', () => {
  it('sizes glyphs in the token range from ICON_SIZE, never a literal, default or ternary', () => {
    const offenders: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const dir of root.dirs) {
        for (const file of listSourceFiles({ dir: join(root.base, dir) })) {
          const path = `${root.prefix}/${relative(root.base, file).split(sep).join('/')}`;
          if (isAllowed({ path })) {
            continue;
          }
          readFileSync(file, 'utf8')
            .split('\n')
            .forEach((line, idx) => {
              if (TOKENIZED_SIZE.test(line)) {
                offenders.push(`${path}:${idx + 1} ${line.trim()}`);
              }
            });
        }
      }
    }
    expect(
      offenders,
      `Icon sizes ${TOKENIZED_RANGE} come from ICON_SIZE (mark, row, control, notice, hero) in packages/ui/src/iconSize.ts, and scale-rules.test.ts holds the smaller sizes. Replace the literal in:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps every allowlisted exception pointed at a path that still exists', () => {
    const repoRoot = join(DESKTOP_SRC, '..', '..', '..');
    const missing = ALLOWLIST.filter((entry) => {
      try {
        statSync(join(repoRoot, entry.path));
        return false;
      } catch {
        return true;
      }
    }).map((entry) => entry.path);
    expect(missing, `Stale icon-size allowlist entries:\n${missing.join('\n')}`).toEqual([]);
  });
});
