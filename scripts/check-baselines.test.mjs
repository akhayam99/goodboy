import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowedEntries,
  baselineEntries,
  findGrowth,
  parseExceptions,
} from './check-baselines.mjs';

const PATH = 'apps/desktop/src/__tests__/regressions/forbidden-patterns.baseline.json';

const growth = ({ base, head, exceptions = [], path = PATH, kind = 'json' }) =>
  findGrowth({
    files: [{ path, kind }],
    readBase: () => base,
    readHead: () => head,
    exceptions,
  });

const json = (value) => JSON.stringify(value);

describe('findGrowth on a baseline json', () => {
  it('fails when an entry grew', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 2 } }),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /else-branch > a\.ts: 2 \(base 1\)/);
  });

  it('fails on a new key above zero', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 1, 'b.ts': 1 } }),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /b\.ts: 1 \(base 0\)/);
  });

  it('fails on a new ratchet rule above zero', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 1 }, 'rust-else': { 'x.rs': 3 } }),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /rust-else > x\.rs: 3 \(base 0\)/);
  });

  it('passes when a count falls, a key leaves or a new key is zero', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 3, 'b.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 2 }, 'rust-else': { 'x.rs': 0 } }),
    });
    assert.deepEqual(lines, []);
  });

  it('passes when the count did not move', () => {
    const text = json({ 'else-branch': { 'a.ts': 4 } });
    assert.deepEqual(growth({ base: text, head: text }), []);
  });

  it('passes a growth that an exception lists, up to its count', () => {
    const exceptions = [
      { rule: 'else-branch', file: 'a.ts', count: 2, reason: 'owner approved', release: '0.24.0' },
    ];
    const base = json({ 'else-branch': { 'a.ts': 1 } });
    assert.deepEqual(
      growth({ base, head: json({ 'else-branch': { 'a.ts': 2 } }), exceptions }),
      [],
    );
    assert.equal(
      growth({ base, head: json({ 'else-branch': { 'a.ts': 3 } }), exceptions }).length,
      1,
    );
  });

  it('matches an exception by the baseline name for a flat file', () => {
    const exceptions = [
      { rule: 'truthy-queries', file: 'a.test.ts', count: 1, reason: 'owner', release: '0.24.0' },
    ];
    const lines = growth({
      path: 'apps/desktop/src/__tests__/regressions/truthy-queries.baseline.json',
      base: json({}),
      head: json({ 'a.test.ts': 1 }),
      exceptions,
    });
    assert.deepEqual(lines, []);
  });

  it('skips a baseline file that does not exist on the base', () => {
    assert.deepEqual(growth({ base: null, head: json({ 'else-branch': { 'a.ts': 9 } }) }), []);
  });

  it('reads the count of an entry that carries a reason', () => {
    const lines = growth({
      path: 'apps/desktop/src/__tests__/regressions/jargon-copy.baseline.json',
      base: json({ 'a.ts': { count: 1, reason: 'agent' } }),
      head: json({ 'a.ts': { count: 2, reason: 'agent' } }),
    });
    assert.equal(lines.length, 1);
  });
});

describe('findGrowth on the eslint suppressions', () => {
  const SUPPRESSIONS = 'eslint-suppressions.json';
  const suppressions = (count) =>
    json({ 'apps/desktop/src/a.ts': { '@typescript-eslint/no-floating-promises': { count } } });

  it('fails when a suppression count grew', () => {
    const lines = growth({
      path: SUPPRESSIONS,
      base: suppressions(1),
      head: suppressions(2),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /no-floating-promises > count: 2 \(base 1\)/);
  });

  it('passes when a suppression count falls', () => {
    assert.deepEqual(
      growth({ path: SUPPRESSIONS, base: suppressions(2), head: suppressions(1) }),
      [],
    );
  });

  it('names the rule after the file without the baseline suffix', () => {
    const entries = baselineEntries({ path: SUPPRESSIONS, text: suppressions(3) });
    assert.equal(entries[0].rule, 'eslint-suppressions');
  });
});

describe('allowedEntries', () => {
  const source = (body) => `const ALLOWED: Readonly<Record<string, number>> = {\n${body}\n};\n`;

  it('reads a number map', () => {
    const entries = allowedEntries({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      text: source("  'a.tsx': 2,\n  'b.tsx': 1,"),
    });
    assert.deepEqual(
      entries.map(({ key, count }) => [key, count]),
      [
        ['ALLOWED > a.tsx', 2],
        ['ALLOWED > b.tsx', 1],
      ],
    );
  });

  it('reads an allowance with a count and a reason', () => {
    const entries = allowedEntries({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      text: source("  'a.tsx': {\n    count: 3,\n    reason: 'chrome, menu',\n  },"),
    });
    assert.equal(entries[0].count, 3);
  });

  it('counts a string reason or a set member as one', () => {
    const reasons = allowedEntries({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      text: source("  'a.tsx': 'list header, not a map',"),
    });
    assert.equal(reasons[0].count, 1);
    const members = allowedEntries({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      text: "const ALLOWED = new Set([\n  'a.tsx',\n  'b.tsx',\n]);\n",
    });
    assert.deepEqual(
      members.map(({ key }) => key),
      ['ALLOWED > a.tsx', 'ALLOWED > b.tsx'],
    );
  });

  it('ignores a declaration that is not a map', () => {
    const entries = allowedEntries({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      text: "const ALLOWED = ['app', 'components', ''].join(sep);\n",
    });
    assert.deepEqual(entries, []);
  });

  it('fails when an allowlist entry grew or a new one appears', () => {
    const path = 'apps/desktop/src/__tests__/x.test.ts';
    const lines = growth({
      path,
      kind: 'allowed',
      base: source("  'a.tsx': 1,"),
      head: source("  'a.tsx': 2,\n  'b.tsx': 1,"),
    });
    assert.equal(lines.length, 2);
  });

  it('passes when an allowlist shrinks', () => {
    const lines = growth({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      kind: 'allowed',
      base: source("  'a.tsx': 2,\n  'b.tsx': 1,"),
      head: source("  'a.tsx': 1,"),
    });
    assert.deepEqual(lines, []);
  });
});

describe('parseExceptions', () => {
  it('accepts the empty list and a complete entry', () => {
    assert.deepEqual(parseExceptions({ text: '[]' }), []);
    const entry = { rule: 'r', file: 'f', count: 1, reason: 'why', release: '0.24.0' };
    assert.deepEqual(parseExceptions({ text: json([entry]) }), [entry]);
  });

  it('rejects an entry without a reason or a release', () => {
    assert.throws(() => parseExceptions({ text: json([{ rule: 'r', file: 'f', count: 1 }]) }));
    assert.throws(() =>
      parseExceptions({
        text: json([{ rule: 'r', file: 'f', count: 1, reason: '', release: '0.24.0' }]),
      }),
    );
    assert.throws(() => parseExceptions({ text: '{}' }));
  });
});
