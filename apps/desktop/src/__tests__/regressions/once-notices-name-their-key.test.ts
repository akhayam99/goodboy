// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'MockScene']);

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

type ObjectSpan = {
  readonly start: number;
  readonly end: number;
};

type SpanParams = {
  readonly source: string;
  readonly at: number;
};

const enclosingObject = ({ source, at }: SpanParams): ObjectSpan => {
  let depth = 0;
  let start = at;
  while (start > 0) {
    start -= 1;
    const char = source[start];
    if (char === '}') {
      depth += 1;
    }
    if (char === '{') {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    }
  }
  depth = 0;
  let end = at;
  while (end < source.length) {
    const char = source[end];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    }
    end += 1;
  }
  return { start, end };
};

const lineOf = ({ source, at }: SpanParams): number => source.slice(0, at).split('\n').length;

describe('a notice sent once', () => {
  it('names its own coalesceKey on the same object, so a new title never makes the same event show twice', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(DESKTOP_SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bisOnce\s*:\s*true\b/g)) {
        const at = match.index ?? 0;
        const span = enclosingObject({ source, at });
        if (!/\bcoalesceKey\b/.test(source.slice(span.start, span.end))) {
          offenders.push(`${relative(DESKTOP_SRC, file)}:${lineOf({ source, at })}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('flags a keyless once notice even when a keyed emit sits right above it', () => {
    const source = [
      "emit({ title: 'A', coalesceKey: 'a', isOnce: true });",
      "emit({ title: 'B', isOnce: true });",
    ].join('\n');
    const at = source.indexOf('isOnce', source.indexOf("'B'"));
    const span = enclosingObject({ source, at });
    expect(source.slice(span.start, span.end)).not.toContain('coalesceKey');
  });

  it('accepts the key written after isOnce', () => {
    const source = "emit({ isOnce: true, coalesceKey: 'a' });";
    const span = enclosingObject({ source, at: source.indexOf('isOnce') });
    expect(source.slice(span.start, span.end)).toContain('coalesceKey');
  });
});
