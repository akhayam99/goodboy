import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowedEntries,
  baselineEntries,
  findGrowth,
  parseExceptions,
} from './check-baselines.mjs';

const PATH = 'apps/desktop/src/__tests__/regressions/forbidden-patterns.baseline.json';

const growth = ({
  base,
  head,
  exceptions = [],
  path = PATH,
  kind = 'json',
  fileExists,
  existedAtBase,
}) =>
  findGrowth({
    files: [{ path, kind }],
    readBase: () => base,
    readHead: () => head,
    exceptions,
    fileExists,
    existedAtBase,
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

  it('passes a new rule key in an existing ledger, its first measured count', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 1 }, 'rust-else': { 'x.rs': 3 } }),
    });
    assert.deepEqual(lines, []);
  });

  it('fails a rule key the base already had when it gains a file', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 1 }, 'rust-else': {} }),
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

  it('fails a baseline file that does not exist on the base and holds debt', () => {
    const lines = growth({ base: null, head: json({ 'else-branch': { 'a.ts': 9 } }) });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /new baseline file/);
  });

  it('passes a new baseline file that starts at zero', () => {
    assert.deepEqual(growth({ base: null, head: json({ 'else-branch': { 'a.ts': 0 } }) }), []);
    assert.deepEqual(growth({ base: null, head: json({}) }), []);
  });

  it('passes a new baseline file the owner named in an exception', () => {
    const exceptions = [{ rule: 'new', file: PATH, count: 9, reason: 'x', release: '0.1.0' }];
    assert.deepEqual(
      growth({ base: null, head: json({ 'else-branch': { 'a.ts': 9 } }), exceptions }),
      [],
    );
  });

  it('fails a new baseline file that holds more than its exception allows', () => {
    const exceptions = [{ rule: 'new', file: PATH, count: 9, reason: 'x', release: '0.1.0' }];
    const lines = growth({ base: null, head: json({ 'else-branch': { 'a.ts': 10 } }), exceptions });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /new baseline file/);
  });

  it('does not take a growth exception for a new baseline file', () => {
    const exceptions = [{ rule: 'else-branch', file: 'a.ts', count: 9, reason: 'x', release: '1' }];
    assert.equal(
      growth({ base: null, head: json({ 'else-branch': { 'a.ts': 9 } }), exceptions }).length,
      1,
    );
  });

  it('fails a baseline file removed while it still held debt', () => {
    const lines = findGrowth({
      files: [],
      baseFiles: [{ path: PATH, kind: 'json' }],
      readBase: () => json({ 'else-branch': { 'a.ts': 2 } }),
      readHead: () => null,
      exceptions: [],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /baseline removed/);
  });

  it('passes the removal of a baseline that held nothing, or one the owner named', () => {
    const removal = ({ text, exceptions = [] }) =>
      findGrowth({
        files: [],
        baseFiles: [{ path: PATH, kind: 'json' }],
        readBase: () => text,
        readHead: () => null,
        exceptions,
      });
    assert.deepEqual(removal({ text: json({ 'else-branch': { 'a.ts': 0 } }) }), []);
    assert.deepEqual(
      removal({
        text: json({ 'else-branch': { 'a.ts': 2 } }),
        exceptions: [{ rule: 'removed', file: PATH, count: 2, reason: 'x', release: '1' }],
      }),
      [],
    );
  });

  it('passes a rename or split, where the new files carry no more than the removed ones', () => {
    const OLD = 'apps/desktop/src/__tests__/regressions/old.baseline.json';
    const NEW_A = 'apps/desktop/src/__tests__/regressions/a.baseline.json';
    const NEW_B = 'apps/desktop/src/__tests__/regressions/b.baseline.json';
    const texts = new Map([
      [OLD, json({ 'else-branch': { 'a.ts': 2, 'b.ts': 1 } })],
      [NEW_A, json({ 'else-branch': { 'a.ts': 2 } })],
      [NEW_B, json({ 'else-branch': { 'b.ts': 1 } })],
    ]);
    const lines = findGrowth({
      files: [
        { path: NEW_A, kind: 'json' },
        { path: NEW_B, kind: 'json' },
      ],
      baseFiles: [{ path: OLD, kind: 'json' }],
      readBase: ({ path }) => (path === OLD ? texts.get(OLD) : null),
      readHead: ({ path }) => (path === OLD ? null : (texts.get(path) ?? null)),
      exceptions: [],
    });
    assert.deepEqual(lines, []);
  });

  it('fails a split whose new files carry more than the removed one', () => {
    const OLD = 'apps/desktop/src/__tests__/regressions/old.baseline.json';
    const NEW = 'apps/desktop/src/__tests__/regressions/new.baseline.json';
    const lines = findGrowth({
      files: [{ path: NEW, kind: 'json' }],
      baseFiles: [{ path: OLD, kind: 'json' }],
      readBase: ({ path }) => (path === OLD ? json({ 'else-branch': { 'a.ts': 1 } }) : null),
      readHead: ({ path }) => (path === OLD ? null : json({ 'else-branch': { 'a.ts': 3 } })),
      exceptions: [],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /new baseline file/);
  });

  it('fails a baseline copied in two, where one removed file covers only one new file', () => {
    const OLD = 'apps/desktop/src/__tests__/regressions/old.baseline.json';
    const COPY_A = 'apps/desktop/src/__tests__/regressions/a.baseline.json';
    const COPY_B = 'apps/desktop/src/__tests__/regressions/b.baseline.json';
    const debt = json({ 'else-branch': { 'a.ts': 5 } });
    const lines = findGrowth({
      files: [
        { path: COPY_A, kind: 'json' },
        { path: COPY_B, kind: 'json' },
      ],
      baseFiles: [{ path: OLD, kind: 'json' }],
      readBase: ({ path }) => (path === OLD ? debt : null),
      readHead: ({ path }) => (path === OLD ? null : debt),
      exceptions: [],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /b\.baseline\.json: new baseline file/);
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

describe('findGrowth on a rename or a split', () => {
  it('passes a renamed file whose count did not move', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'ledgerCore.ts': 2 } }),
      head: json({ 'else-branch': { 'ledgerCoreView.ts': 2 } }),
    });
    assert.deepEqual(lines, []);
  });

  it('passes a split whose total count did not move', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'notifyRelay.ts': 3 } }),
      head: json({ 'else-branch': { 'notifyRelay.ts': 1, 'notifyRelayRows.ts': 2 } }),
    });
    assert.deepEqual(lines, []);
  });

  it('fails a split whose total count grew', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'notifyRelay.ts': 3 } }),
      head: json({ 'else-branch': { 'notifyRelay.ts': 1, 'notifyRelayRows.ts': 3 } }),
    });
    assert.deepEqual(lines, [`  - ${PATH} else-branch > notifyRelayRows.ts: 3 (base 0)`]);
  });

  it('fails a renamed file that also grew', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'ledgerCore.ts': 2 } }),
      head: json({ 'else-branch': { 'ledgerCoreView.ts': 3 } }),
    });
    assert.equal(lines.length, 1);
  });

  it('does not net a fall of one rule against a new file of another rule', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 2 }, any: {} }),
      head: json({ 'else-branch': { 'a.ts': 0 }, any: { 'b.ts': 2 } }),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /any > b\.ts: 2 \(base 0\)/);
  });

  it('spends the freed count once', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'a.ts': 2 } }),
      head: json({ 'else-branch': { 'b.ts': 2, 'c.ts': 2 } }),
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /c\.ts: 2 \(base 0\)/);
  });

  it('counts only a freed file that existed on the base', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'gone.ts': 2 } }),
      head: json({ 'else-branch': { 'b.ts': 2 } }),
      existedAtBase: () => false,
    });
    assert.equal(lines.length, 1);
  });

  it('nets a rename inside a flat baseline', () => {
    const lines = growth({
      path: 'apps/desktop/src/__tests__/regressions/truthy-queries.baseline.json',
      base: json({ 'a.test.ts': 2 }),
      head: json({ 'b.test.ts': 2 }),
    });
    assert.deepEqual(lines, []);
  });

  it('passes a renamed allowlist entry whose count did not move', () => {
    const source = (body) => `const ALLOWED: Readonly<Record<string, number>> = {\n${body}\n};\n`;
    const lines = growth({
      path: 'apps/desktop/src/__tests__/x.test.ts',
      kind: 'allowed',
      base: source("  'paymentsApi.tsx': 1,"),
      head: source("  'paymentsApiPanel.tsx': 1,"),
    });
    assert.deepEqual(lines, []);
  });

  it('does not net an eslint suppression of a new rule', () => {
    const lines = growth({
      path: 'eslint-suppressions.json',
      base: json({ 'a.ts': { 'no-floating-promises': { count: 1 } } }),
      head: json({
        'a.ts': { 'no-floating-promises': { count: 0 } },
        'b.ts': { 'no-misused-promises': { count: 1 } },
      }),
    });
    assert.equal(lines.length, 1);
  });
});

describe('findGrowth on a key that names a missing file', () => {
  const missing = ({ path }) => path !== 'gone.ts';

  it('fails a key whose file does not exist', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'gone.ts': 1 } }),
      head: json({ 'else-branch': { 'gone.ts': 1 } }),
      fileExists: missing,
    });
    assert.deepEqual(lines, [
      `  - ${PATH} else-branch > gone.ts: names a file that does not exist, remove the key`,
    ]);
  });

  it('fails it in a baseline new on the base too', () => {
    const lines = growth({
      base: null,
      head: json({ 'else-branch': { 'gone.ts': 1 } }),
      fileExists: missing,
    });
    assert.ok(lines.some((line) => line.includes('names a file that does not exist')));
  });

  it('passes when the dead key is pruned', () => {
    const lines = growth({
      base: json({ 'else-branch': { 'gone.ts': 1, 'a.ts': 1 } }),
      head: json({ 'else-branch': { 'a.ts': 1 } }),
      fileExists: missing,
    });
    assert.deepEqual(lines, []);
  });

  it('reads a path nested under a rule or a count key', () => {
    const lines = growth({
      path: 'apps/desktop/src/__tests__/regressions/hand-made-notices-and-empty-lines.baseline.json',
      base: json({ 'gone.ts': { notices: 1 } }),
      head: json({ 'gone.ts': { notices: 1 } }),
      fileExists: missing,
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
