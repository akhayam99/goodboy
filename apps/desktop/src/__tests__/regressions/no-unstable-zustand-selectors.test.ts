import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      listSourceFiles(full, acc);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx') &&
      !entry.endsWith('.d.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const USE_APP_STORE_CALL = /useAppStore\s*\(/g;
const SAFE_OPT_OUT_COMMENT = /useShallow not needed/;

function extractCallBody(
  source: string,
  openParenIdx: number,
): { body: string; endIdx: number } | null {
  let depth = 0;
  for (let i = openParenIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { body: source.slice(openParenIdx + 1, i), endIdx: i + 1 };
      }
    }
  }
  return null;
}

const UNSTABLE_TAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /\.\s*(?:filter|map|sort|concat|slice|flatMap|reduce|reverse)\s*\(([^()]|\([^()]*\))*\)\s*$/,
  /\?\?\s*[[{]\s*[\]}]\s*$/,
  /\[\s*\.\.\.[^\]]*\]\s*$/,
  /\{\s*\.\.\.[^}]*\}\s*$/,
];

type BadCall = {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

function lineOf(content: string, idx: number): number {
  return content.slice(0, idx).split('\n').length;
}

function selectorTail(body: string): string {
  const trimmed = body.trim();
  const arrowMatch = trimmed.match(/=>\s*([\s\S]*)$/);
  const expr = arrowMatch?.[1] ?? trimmed;
  return expr.replace(/[;,]\s*$/, '').trim();
}

function checkFile(path: string): BadCall[] {
  const content = readFileSync(path, 'utf-8');
  const bad: BadCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = USE_APP_STORE_CALL.exec(content)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const extracted = extractCallBody(content, openParen);
    if (!extracted) continue;
    const { body } = extracted;
    if (body.includes('useShallow(')) continue;
    if (SAFE_OPT_OUT_COMMENT.test(body)) continue;
    const tail = selectorTail(body);
    const isUnstable = UNSTABLE_TAIL_PATTERNS.some((re) => re.test(tail));
    if (!isUnstable) continue;
    bad.push({
      file: relative(SRC_ROOT, path).split(sep).join('/'),
      line: lineOf(content, match.index),
      snippet: tail.replace(/\s+/g, ' ').slice(0, 140),
    });
  }
  return bad;
}

describe('no unstable useAppStore selectors without useShallow', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('every useAppStore call that derives a non-primitive uses useShallow', () => {
    const bad = files.flatMap(checkFile);
    if (bad.length > 0) {
      const lines = bad.map((b) => `  - ${b.file}:${b.line}\n      ${b.snippet}`);
      throw new Error(
        `Found ${bad.length} useAppStore selector(s) that derive fresh references ` +
          `without useShallow. React 19 useSyncExternalStore will detect a snapshot ` +
          `mismatch and bail into an infinite render loop. Wrap each selector in ` +
          `useShallow from zustand/react/shallow, or add a "useShallow not needed: ..." ` +
          `comment if you have proof the selector is stable.\n\n${lines.join('\n')}`,
      );
    }
    expect(bad).toEqual([]);
  });
});
