import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const STORE_DIR = join(DESKTOP_SRC, 'store');
const HARNESS = join(STORE_DIR, 'storyHarness.ts');
const STORE_ENTRIES = new Set([join(STORE_DIR, 'store'), join(STORE_DIR, 'index'), STORE_DIR]);
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);
const DYNAMIC_IMPORT = /(?<!typeof\s)\bimport\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g;

const listTestFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listTestFiles(full, acc);
      continue;
    }
    if (/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const stripExtension = (path: string) => path.replace(/\.(ts|tsx)$/, '');

describe('store import pattern', () => {
  it('loads the store only through storyHarness, once per file in beforeAll', () => {
    const offenders: string[] = [];
    for (const file of listTestFiles(DESKTOP_SRC)) {
      if (file === HARNESS) {
        continue;
      }
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, idx) => {
          for (const match of line.matchAll(DYNAMIC_IMPORT)) {
            const target = stripExtension(resolve(dirname(file), match[1] ?? ''));
            if (STORE_ENTRIES.has(target)) {
              offenders.push(`${relative(DESKTOP_SRC, file)}:${idx + 1} ${line.trim()}`);
            }
          }
        });
    }
    expect(
      offenders,
      `Import the store with importStore() from store/storyHarness.ts inside beforeAll(..., STORE_IMPORT_TIMEOUT_MS). A per-test import lands the cold module graph on whichever test runs first and times out under load:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
