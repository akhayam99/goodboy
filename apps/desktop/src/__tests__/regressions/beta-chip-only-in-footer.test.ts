import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);
const ALLOWED = ['shared', 'components', 'BetaPill', 'index.tsx'].join(sep);

const BETA_LABEL = /label=(?:"Beta"|\{'Beta'\}|\{"Beta"\})/i;
const BETA_TEXT = />\s*Beta\s*</i;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('beta chip', () => {
  it('renders in the footer pill and nowhere else in the app', () => {
    const offenders: string[] = [];
    for (const root of [DESKTOP_SRC, UI_SRC]) {
      for (const file of listSourceFiles(root)) {
        if (file.endsWith(ALLOWED)) {
          continue;
        }
        const source = readFileSync(file, 'utf8');
        source.split('\n').forEach((line, idx) => {
          if (BETA_LABEL.test(line) || BETA_TEXT.test(line)) {
            offenders.push(`${relative(root, file)}:${idx + 1} ${line.trim()}`);
          }
        });
      }
    }
    expect(
      offenders,
      `A Beta chip may only live in the footer pill (shared/components/BetaPill). Remove these:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
