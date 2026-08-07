import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const UI_SRC = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'ui', 'src');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const LOADER2_REFERENCE = /\bLoader2\b/;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('shared ui package', () => {
  it('never imports the banned Loader2 spinner', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(UI_SRC)) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, idx) => {
        if (LOADER2_REFERENCE.test(line)) {
          offenders.push(`${relative(UI_SRC, file)}:${idx + 1} ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `DESIGN.md forbids spinners: loading is a skeleton, running is a moving border or a pulsing StatusDot. Remove Loader2 from:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
