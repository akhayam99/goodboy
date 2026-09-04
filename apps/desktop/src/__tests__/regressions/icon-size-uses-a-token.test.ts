import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app'];
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);

const TOKENIZED_SIZE = /size=\{(1[2-8])\}/;
const TOKENIZED_RANGE = '12 to 18';

type Exception = {
  readonly path: string;
  readonly reason: string;
};

const ALLOWLIST: ReadonlyArray<Exception> = [
  {
    path: 'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
    reason: 'the literal is the HTML input size attribute in characters, not an icon size',
  },
];

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
};

const isAllowed = (relativePath: string): boolean =>
  ALLOWLIST.some(
    (entry) => relativePath === entry.path || relativePath.startsWith(`${entry.path}/`),
  );

describe('icon sizing', () => {
  it('sizes glyphs in the token range (12 to 18) from ICON_SIZE, never a literal', () => {
    const offenders: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of listSourceFiles(join(DESKTOP_SRC, root))) {
        const relativePath = relative(DESKTOP_SRC, file).split(sep).join('/');
        if (isAllowed(relativePath)) {
          continue;
        }
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, idx) => {
            if (TOKENIZED_SIZE.test(line)) {
              offenders.push(`${relativePath}:${idx + 1} ${line.trim()}`);
            }
          });
      }
    }
    expect(
      offenders,
      `Icon sizes ${TOKENIZED_RANGE} come from ICON_SIZE (row, control, hero) in shared/components/conceptIcons.ts; smaller marks inside chips and dots stay literal. Replace the literal in:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps every allowlisted exception pointed at a path that still exists', () => {
    const missing = ALLOWLIST.filter((entry) => {
      try {
        statSync(join(DESKTOP_SRC, entry.path));
        return false;
      } catch {
        return true;
      }
    }).map((entry) => entry.path);
    expect(missing, `Stale icon-size allowlist entries:\n${missing.join('\n')}`).toEqual([]);
  });
});
