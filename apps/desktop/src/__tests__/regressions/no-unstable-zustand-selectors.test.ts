/**
 * Static guard against the React #185 regression fixed in PR #648.
 *
 * The bug pattern:
 *
 *     useAppStore((s) => s.foo.filter(...).map(...))   // new array per call
 *     useAppStore((s) => s.bar[id] ?? [])              // new array on miss
 *     useAppStore((s) => [...s.baz])                   // new array via spread
 *     useAppStore((s) => ({ a: s.x, b: s.y }))         // new object literal
 *
 * React 19's useSyncExternalStore compares the snapshot to the previous one
 * via Object.is. A fresh non-primitive always fails that check and triggers
 * an infinite re-render loop ("the result of getSnapshot should be cached").
 *
 * The fix is to wrap the offending selector in `useShallow` from
 * `zustand/react/shallow`, which switches the comparison to a shallow value
 * check so two arrays/objects with identical contents are treated as equal.
 *
 * This test scans every .ts / .tsx file in src/ for the antipattern and
 * fails if any unwrapped occurrence is found. Better to break the build than
 * ship another full-app crash on the user.
 *
 * Limitations:
 *   - Regex-based, not AST-based. Catches the common shapes but a sufficiently
 *     creative formatting could slip through. False positives can be silenced
 *     with an explicit `// useShallow not needed: ...` comment on the line.
 *   - Does not check that useShallow is actually imported. If you wrap an
 *     unstable selector in a function called `useShallow` from somewhere
 *     else, this test passes but TypeScript will catch it.
 */

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

// Heuristic for "this selector derives a fresh non-primitive each call".
// We grab the body of every useAppStore() and look at the LAST evaluated
// expression. If that expression is one of the array/object-producing forms
// listed below we flag it; if it's a primitive coercion (.find(...), [0],
// .some(...), .length, ?? null, etc) we let it pass even if the intermediate
// shape used a fresh array. False positives can be silenced with a literal
// `useShallow not needed:` comment inside the selector body.
const USE_APP_STORE_CALL = /useAppStore\s*\(/g;
const SAFE_OPT_OUT_COMMENT = /useShallow not needed/;

// Extract the body of a `useAppStore(...)` call starting at `openParenIdx`
// (the index of the `(` immediately after `useAppStore`). Returns the body
// text (without the outer parens) and the index right after the matching
// `)`. Returns null if the parens are unbalanced (truncated source).
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

// Trailing fresh-non-primitive expressions: anything matched here is the
// last thing evaluated by the selector, so the result IS the freshly built
// value. These are the actual bug shapes.
const UNSTABLE_TAIL_PATTERNS: ReadonlyArray<RegExp> = [
  // `.filter(...)`, `.map(...)`, etc as the final call
  /\.\s*(?:filter|map|sort|concat|slice|flatMap|reduce|reverse)\s*\(([^()]|\([^()]*\))*\)\s*$/,
  // `... ?? []` or `... ?? {}` as the final expression
  /\?\?\s*[[{]\s*[\]}]\s*$/,
  // Bare array spread literal `[...x]` at the end
  /\[\s*\.\.\.[^\]]*\]\s*$/,
  // Bare object spread literal `{ ...x }` at the end
  /\{\s*\.\.\.[^}]*\}\s*$/,
];

interface BadCall {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

function lineOf(content: string, idx: number): number {
  return content.slice(0, idx).split('\n').length;
}

function selectorTail(body: string): string {
  // Drop trailing whitespace and an optional `=> ` arrow prefix. We care
  // about the rightmost expression of the lambda body.
  const trimmed = body.trim();
  // If the body is `(s) => expr`, lop off the `(s) => ` so we see the expr.
  const arrowMatch = trimmed.match(/=>\s*([\s\S]*)$/);
  const expr = arrowMatch?.[1] ?? trimmed;
  // Drop a trailing optional semicolon or comma.
  return expr.replace(/[;,]\s*$/, '').trim();
}

function checkFile(path: string): BadCall[] {
  const content = readFileSync(path, 'utf-8');
  const bad: BadCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = USE_APP_STORE_CALL.exec(content)) !== null) {
    // `match.index + match[0].length - 1` points at the `(` after useAppStore
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
