import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);
const RELATIVE_MOCK = /\bvi\.(?:mock|doMock)\(\s*['"](\.{1,2}\/[^'"]*)['"]/g;
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

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

const resolvesToFile = ({ base }: { base: string }) =>
  CANDIDATE_SUFFIXES.some((suffix) => {
    const candidate = `${base}${suffix}`;
    return existsSync(candidate) && statSync(candidate).isFile();
  });

describe('relative vi.mock targets', () => {
  it('points every relative vi.mock at a file that exists', () => {
    const offenders: string[] = [];
    for (const file of listTestFiles(DESKTOP_SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(RELATIVE_MOCK)) {
        const specifier = match[1] ?? '';
        if (!resolvesToFile({ base: resolve(dirname(file), specifier) })) {
          offenders.push(`${relative(DESKTOP_SRC, file)} ${specifier}`);
        }
      }
    }
    expect(
      offenders,
      `A vi.mock whose target does not exist mocks nothing: the test keeps passing while the real module runs. Delete the mock or point it at the moved file:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
