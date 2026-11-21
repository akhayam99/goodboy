// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'MockScene']);
const LOOK_BACK_LINES = 14;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe('a notice sent once', () => {
  it('names its own coalesceKey, so a new title never makes the same event show twice', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(DESKTOP_SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (!/^\s*isOnce: true,?\s*$/.test(line)) {
          return;
        }
        const before = lines.slice(Math.max(0, idx - LOOK_BACK_LINES), idx);
        if (!before.some((candidate) => /\bcoalesceKey\b/.test(candidate))) {
          offenders.push(`${relative(DESKTOP_SRC, file)}:${idx + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
