// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { HOT_SLICE_KEYS } from './hotSliceKeys';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const SRC_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
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
const RECORD_KEY_DECLARATION = /readonly\s+(\w+)\s*:\s*Readonly<\s*Record</g;
const WHOLE_RECORD_BASELINE = 'whole-record-selectors.baseline.json';

function extractCallBody(
  source: string,
  openParenIdx: number,
): { body: string; endIdx: number } | null {
  let depth = 0;
  for (let i = openParenIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
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
  /[?:]\s*(?:\[\s*\]|\{\s*\})\s*\)*\s*$/,
  /\[\s*\.\.\.[^\]]*\]\s*$/,
  /\{\s*\.\.\.[^}]*\}\s*$/,
];

const stateSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      stateSources(full, acc);
    } else if (
      /(?:^|[A-Za-z])(?:state|types|State)\.ts$/.test(entry) &&
      !entry.endsWith('.test.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
};

const RECORD_KEYS: ReadonlySet<string> = new Set(
  stateSources(join(SRC_ROOT, 'store')).flatMap((file) =>
    [...readFileSync(file, 'utf-8').matchAll(RECORD_KEY_DECLARATION)].map(
      (match) => match[1] ?? '',
    ),
  ),
);

const WHOLE_SLICE_TAIL = /^(?:state|s|store)\.([A-Za-z_$][\w$]*)$/;

const OPENERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };

const skipString = (source: string, start: number): number => {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === quote) {
      return i;
    }
  }
  return source.length;
};

const matchingClose = (source: string, start: number): number => {
  const stack: string[] = [];
  for (let i = start; i < source.length; i++) {
    const ch = source[i] ?? '';
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i);
      continue;
    }
    const closer = OPENERS[ch];
    if (closer !== undefined) {
      stack.push(closer);
      continue;
    }
    if (ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return i;
      }
    }
  }
  return -1;
};

const isWholeLiteral = (expr: string): boolean => {
  const trimmed = expr.trim();
  const opener = trimmed[0];
  if (opener !== '[' && opener !== '{') {
    return false;
  }
  const close = matchingClose(trimmed, 0);
  return close !== -1 && /^[\s;]*$/.test(trimmed.slice(close + 1));
};

const unwrapParens = (expr: string): string => {
  const trimmed = expr.trim();
  if (!trimmed.startsWith('(')) {
    return trimmed;
  }
  const close = matchingClose(trimmed, 0);
  if (close === -1 || trimmed.slice(close + 1).trim() !== '') {
    return trimmed;
  }
  return unwrapParens(trimmed.slice(1, close));
};

const RETURN_LITERAL = /\breturn\s*(?=[[{(])/g;

const blockReturnsLiteral = (block: string): boolean => {
  let match: RegExpExecArray | null;
  RETURN_LITERAL.lastIndex = 0;
  while ((match = RETURN_LITERAL.exec(block)) !== null) {
    const start = match.index + match[0].length;
    const close = matchingClose(block, start);
    if (close === -1) {
      continue;
    }
    const expr = unwrapParens(block.slice(start, close + 1));
    const after = block.slice(close + 1).trimStart();
    if (isWholeLiteral(expr) && /^(?:[;}]|$)/.test(after)) {
      return true;
    }
  }
  return false;
};

const selectorReturnsLiteral = (body: string): boolean => {
  const arrow = body.indexOf('=>');
  if (arrow === -1) {
    return false;
  }
  const expr = body.slice(arrow + 2).trim();
  if (expr.startsWith('{')) {
    const close = matchingClose(expr, 0);
    return close !== -1 && blockReturnsLiteral(expr.slice(1, close));
  }
  return isWholeLiteral(unwrapParens(expr));
};

type BadCall = {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

type FileReport = {
  readonly unstable: ReadonlyArray<BadCall>;
  readonly wholeSlice: ReadonlyArray<BadCall>;
  readonly wholeRecord: ReadonlyArray<BadCall>;
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

function recordKey(body: string): string | null {
  const tail = selectorTail(body).replace(/\)+$/, '').trim();
  const key = tail.match(WHOLE_SLICE_TAIL)?.[1] ?? null;
  return key !== null && RECORD_KEYS.has(key) ? key : null;
}

function hotSliceKey(body: string): string | null {
  const tail = selectorTail(body).replace(/\)+$/, '').trim();
  const key = tail.match(WHOLE_SLICE_TAIL)?.[1] ?? null;
  if (key === null || !HOT_SLICE_KEYS.has(key)) {
    return null;
  }
  return key;
}

function checkFile(path: string): FileReport {
  const content = readFileSync(path, 'utf-8');
  const unstable: BadCall[] = [];
  const wholeSlice: BadCall[] = [];
  const wholeRecord: BadCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = USE_APP_STORE_CALL.exec(content)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const extracted = extractCallBody(content, openParen);
    if (!extracted) {
      continue;
    }
    const { body } = extracted;
    const at = {
      file: relative(SRC_ROOT, path).split(sep).join('/'),
      line: lineOf(content, match.index),
    };
    if (hotSliceKey(body) !== null) {
      wholeSlice.push({ ...at, snippet: selectorTail(body).replace(/\s+/g, ' ').slice(0, 140) });
      continue;
    }
    if (recordKey(body) !== null) {
      wholeRecord.push({ ...at, snippet: selectorTail(body).replace(/\s+/g, ' ').slice(0, 140) });
      continue;
    }
    if (body.includes('useShallow(')) {
      continue;
    }
    const tail = selectorTail(body);
    const isUnstable =
      selectorReturnsLiteral(body) || UNSTABLE_TAIL_PATTERNS.some((re) => re.test(tail));
    if (!isUnstable) {
      continue;
    }
    unstable.push({ ...at, snippet: tail.replace(/\s+/g, ' ').slice(0, 140) });
  }
  return { unstable, wholeSlice, wholeRecord };
}

describe('the literal selector detector', () => {
  it.each([
    '(state) => ({ sessions: state.sessions, agents: state.agents })',
    '(state) => [state.sessions, state.agents]',
    's => ({ ...s.drafts })',
    '(state) => { const id = state.currentSessionId; return { id, busy: state.busy }; }',
    '(state) => { if (!state.ready) { return null; } return [state.a, state.b]; }',
    "(state) => ({ label: 'a) b', count: state.count })",
  ])('flags %s', (body) => {
    expect(selectorReturnsLiteral(body)).toBe(true);
  });

  it.each([
    '(state) => state.sessions',
    '(state) => state.sessions.find((session) => session.id === id) ?? null',
    '(state) => [...state.ids].sort().join(",")',
    '(state) => { const ids = [state.a]; return ids.length; }',
    '(state) => { return [state.a, state.b].join("|"); }',
    '(state) => state.drafts[id]?.text ?? ""',
  ])('passes %s', (body) => {
    expect(selectorReturnsLiteral(body)).toBe(false);
  });
});

describe('no unstable useAppStore selectors without useShallow', () => {
  const files = listSourceFiles(SRC_ROOT);
  const reports = files.map(checkFile);

  it('no useAppStore call subscribes to a whole write-heavy slice', () => {
    const bad = reports.flatMap((report) => report.wholeSlice);
    if (bad.length > 0) {
      const lines = bad.map((b) => `  - ${b.file}:${b.line}\n      ${b.snippet}`);
      throw new Error(
        `Found ${bad.length} useAppStore selector(s) subscribing to a whole slice that is ` +
          `rewritten while a turn streams (${[...HOT_SLICE_KEYS].join(', ')}). Every consumer ` +
          `then re-renders for every agent of every session. Select the keys the component ` +
          `needs instead (docs/typescript/selectors.md).\n\n${lines.join('\n')}`,
      );
    }
    expect(bad).toEqual([]);
  });

  it('reads the record keys from the state types, never an empty list', () => {
    expect(RECORD_KEYS.size).toBeGreaterThan(150);
    expect(RECORD_KEYS.has('sessionBranches')).toBe(true);
    expect(RECORD_KEYS.has('sessionMounts')).toBe(true);
    expect(RECORD_KEYS.has('currentSessionId')).toBe(false);
  });

  it('adds no subscription to a whole record keyed by an id beyond the baseline', () => {
    const current: FileCounts = Object.fromEntries(
      files
        .map(
          (file, index) =>
            [
              `apps/desktop/src/${relative(SRC_ROOT, file).split(sep).join('/')}`,
              reports[index]?.wholeRecord.length ?? 0,
            ] as const,
        )
        .filter(([, count]) => count > 0),
    );
    if (IS_UPDATING) {
      writeBaseline({ file: WHOLE_RECORD_BASELINE, counts: current });
      return;
    }
    const grown = grownEntries({
      current,
      baseline: readBaseline({ file: WHOLE_RECORD_BASELINE }),
    });
    expect(
      grown,
      `A state key typed as a record keyed by an id changes for every session, agent or mount. ` +
        `Subscribe to the one entry you read, or wrap the keys you need in useShallow ` +
        `(docs/typescript/selectors.md). A cleanup that lowers a count regenerates the baseline ` +
        `with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('every useAppStore call that derives a non-primitive uses useShallow', () => {
    const bad = reports.flatMap((report) => report.unstable);
    if (bad.length > 0) {
      const lines = bad.map((b) => `  - ${b.file}:${b.line}\n      ${b.snippet}`);
      throw new Error(
        `Found ${bad.length} useAppStore selector(s) that derive fresh references ` +
          `without useShallow. React 19 useSyncExternalStore will detect a snapshot ` +
          `mismatch and bail into an infinite render loop. Wrap each selector in ` +
          `useShallow from zustand/react/shallow (docs/typescript/selectors.md).\n\n${lines.join('\n')}`,
      );
    }
    expect(bad).toEqual([]);
  });
});
