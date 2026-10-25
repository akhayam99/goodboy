import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyPath,
  countFor,
  grownOffenses,
  isFlatHook,
  ledgerOf,
  ledgerPath,
  matchedLineNumbers,
  measure,
  shrunkOffenses,
  RULES,
  readSource,
} from './forbiddenPatterns.mjs';

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

const rule = ({ id }) => {
  const found = RULES.find((candidate) => candidate.id === id);
  assert.notEqual(found, undefined, `rule ${id} exists`);
  return found;
};

const count = ({ id, path, text }) => {
  const file = readSource({ path, text });
  assert.notEqual(file, null, `${path} is scanned`);
  return countFor({ rule: rule({ id }), file });
};

describe('classifyPath', () => {
  it('marks core sources, tests and extended trees', () => {
    assert.equal(classifyPath({ path: 'apps/desktop/src/a.ts' }).scope, 'core');
    assert.equal(classifyPath({ path: 'apps/desktop/src/a.test.ts' }).isTest, true);
    assert.equal(classifyPath({ path: 'apps/desktop/src/__tests__/a.ts' }).isTest, true);
    assert.equal(classifyPath({ path: 'apps/desktop/src/a.test.ts' }).scope, 'extended');
    assert.equal(classifyPath({ path: 'website/src/a.tsx' }).scope, 'extended');
    assert.equal(classifyPath({ path: 'apps/desktop/src/styles.css' }).kind, 'css');
    assert.equal(classifyPath({ path: 'scripts/a.mjs' }).kind, 'script');
    assert.equal(classifyPath({ path: 'apps/desktop/src-tauri/src/a.rs' }).kind, 'rust');
    assert.equal(classifyPath({ path: '.github/workflows/ci.yml' }).kind, 'config');
    assert.equal(classifyPath({ path: 'lefthook.yml' }).scope, 'core');
  });

  it('skips what no rule scans', () => {
    assert.equal(classifyPath({ path: 'apps/desktop/src/vite-env.d.ts' }), null);
    assert.equal(classifyPath({ path: 'node_modules/x/src/a.ts' }), null);
    assert.equal(classifyPath({ path: 'pnpm-lock.yaml' }), null);
    assert.equal(classifyPath({ path: 'docs/changelog/a.webp' }), null);
  });
});

describe('param-shape', () => {
  const path = 'apps/desktop/src/features/x/a.ts';
  const id = 'param-shape';

  it('flags an inline object type, on one line or several, and Readonly of one', () => {
    assert.equal(count({ id, path, text: 'export const f = ({ id }: { id: string }) => id;' }), 1);
    assert.equal(count({ id, path, text: 'const h = async ({ a }: Readonly<{ a: 1 }>) => a;' }), 1);
    assert.equal(
      count({
        id,
        path,
        text: 'export const f = ({\n  id,\n}: {\n  readonly id: string;\n}): string => id;',
      }),
      1,
    );
    assert.equal(count({ id, path, text: 'type Run = (params: { ms: number }) => void;' }), 1);
    assert.equal(count({ id, path, text: 'const f = ({ a }: { a: 1 } & Params) => a;' }), 1);
  });

  it('flags a positional or bare parameter on a function we declare', () => {
    assert.equal(count({ id, path, text: 'const f = (a: string, b: number) => a;' }), 1);
    assert.equal(count({ id, path, text: 'export function f(db: Db, id: string) {}' }), 1);
    assert.equal(count({ id, path, text: 'const g = (value: string) => value;' }), 1);
    assert.equal(count({ id, path, text: 'const ctx = { run(x: number) { return x; } };' }), 1);
  });

  it('allows a destructured named type, a callback and a signature without parameters', () => {
    assert.equal(count({ id, path, text: 'export const f = ({ id }: Params) => id;' }), 0);
    assert.equal(count({ id, path, text: 'const f = () => 1;' }), 0);
    assert.equal(count({ id, path, text: 'rows.map((row) => row.id);' }), 0);
    assert.equal(count({ id, path, text: 'rows.reduce((sum, row) => sum + row, 0);' }), 0);
    assert.equal(count({ id, path, text: 'run({ a: { b: 1 } });' }), 0);
    assert.equal(count({ id, path, text: "const text = '({ a }: { a: 1 })';" }), 0);
    assert.equal(count({ id, path, text: 'type Run = (params: Params) => void;' }), 0);
  });

  it('skips tests', () => {
    assert.equal(
      count({
        id,
        path: 'apps/desktop/src/a.test.ts',
        text: 'const f = ({ id }: { id: string }) => id;',
      }),
      0,
    );
  });
});

describe('boolean-name', () => {
  const path = 'apps/desktop/src/features/x/panel.ts';
  const id = 'boolean-name';

  it('flags useState, a field, a parameter and a variable typed boolean without a prefix', () => {
    assert.equal(count({ id, path, text: 'const [open, setOpen] = useState<boolean>(false);' }), 1);
    assert.equal(count({ id, path, text: 'const [busy, setBusy] = useState(false);' }), 1);
    assert.equal(count({ id, path, text: 'type Row = {\n  readonly archived: boolean;\n};' }), 1);
    assert.equal(count({ id, path, text: 'type Row = {\n  disabled?: boolean,\n};' }), 1);
    assert.equal(count({ id, path, text: 'const f = ({ a }: Params, flag: boolean) => a;' }), 1);
    assert.equal(count({ id, path, text: 'const done: boolean = false;' }), 1);
  });

  it('flags a nullable and an optional boolean', () => {
    assert.equal(count({ id, path, text: 'type Row = {\n  mode: boolean | null;\n};' }), 1);
    assert.equal(count({ id, path, text: 'type Row = {\n  mode: boolean | undefined;\n};' }), 1);
    assert.equal(count({ id, path, text: 'type Row = {\n  mode: null | boolean;\n};' }), 1);
  });

  it('allows the prefixes and other shapes', () => {
    assert.equal(
      count({ id, path, text: 'const [isOpen, setOpen] = useState<boolean>(false);' }),
      0,
    );
    assert.equal(count({ id, path, text: 'const [hasError, set] = useState(false);' }), 0);
    assert.equal(count({ id, path, text: 'type Row = {\n  readonly canSend: boolean;\n};' }), 0);
    assert.equal(count({ id, path, text: 'type Row = {\n  shouldFocus?: boolean | null;\n};' }), 0);
    assert.equal(count({ id, path, text: 'const [name, setName] = useState<string>("");' }), 0);
    assert.equal(count({ id, path, text: 'type Row = {\n  mode: string | null;\n};' }), 0);
  });

  it('skips tests', () => {
    assert.equal(
      count({
        id,
        path: 'apps/desktop/src/a.test.ts',
        text: 'type Row = {\n  archived: boolean;\n};',
      }),
      0,
    );
  });
});

describe('if-without-braces', () => {
  const path = 'apps/desktop/src/features/x/a.ts';
  const id = 'if-without-braces';

  it('flags a body that is not a block, whatever the statement', () => {
    assert.equal(count({ id, path, text: 'if (a) return;' }), 1);
    assert.equal(count({ id, path, text: 'if (a) ids.add(a);' }), 1);
    assert.equal(count({ id, path, text: 'if (a) {\n  run();\n} else run();' }), 1);
    assert.equal(count({ id, path, text: 'if (a)\n  run();' }), 1);
  });

  it('allows a block and an else if chain of blocks', () => {
    assert.equal(count({ id, path, text: 'if (a) {\n  return;\n}' }), 0);
    assert.equal(count({ id, path, text: 'if (a) {\n  run();\n} else if (b) {\n  stop();\n}' }), 0);
    assert.equal(count({ id, path, text: "const text = 'if (a) return;';" }), 0);
  });
});

describe('unused-import', () => {
  const path = 'apps/desktop/src/features/x/a.ts';
  const id = 'unused-import';

  it('flags a default, a named, an aliased and a namespace import nothing reads', () => {
    assert.equal(count({ id, path, text: "import Thing from './thing';\nexport const a = 1;" }), 1);
    assert.equal(count({ id, path, text: "import { a, b } from './x';\nexport const c = a;" }), 1);
    assert.equal(
      count({ id, path, text: "import { a as b } from './x';\nexport const c = 1;" }),
      1,
    );
    assert.equal(count({ id, path, text: "import * as x from './x';\nexport const c = 1;" }), 1);
    assert.equal(
      count({ id, path, text: "import type { Row } from './x';\nexport const c = 1;" }),
      1,
    );
  });

  it('allows an import read as a value, a type, a jsx tag or a type query', () => {
    assert.equal(count({ id, path, text: "import { a } from './x';\nexport const c = a;" }), 0);
    assert.equal(
      count({ id, path, text: "import type { Row } from './x';\nexport type T = Row;" }),
      0,
    );
    assert.equal(
      count({
        id,
        path: 'apps/desktop/src/features/x/Row.tsx',
        text: "import { Cell } from './Cell';\nexport const Row = () => <Cell />;",
      }),
      0,
    );
    assert.equal(
      count({ id, path, text: "import { a } from './x';\nexport type T = typeof a;" }),
      0,
    );
    assert.equal(count({ id, path, text: "import './side-effect';" }), 0);
  });
});

describe('rust-else', () => {
  const path = 'apps/desktop/src-tauri/src/a.rs';
  const id = 'rust-else';

  it('flags a closing brace followed by else', () => {
    assert.equal(count({ id, path, text: '    } else {\n        run();\n    }' }), 1);
    assert.equal(count({ id, path, text: '    } else if ready {' }), 1);
  });

  it('allows let else, a guard clause and a commented line', () => {
    assert.equal(count({ id, path, text: '    let Some(value) = map.get(key) else {' }), 0);
    assert.equal(count({ id, path, text: '    if !ready {\n        return;\n    }' }), 0);
    assert.equal(count({ id, path, text: '    // } else {' }), 0);
    assert.equal(count({ id, path, text: 'let text = "} else {";' }), 0);
  });
});

describe('sibling-margin', () => {
  const id = 'sibling-margin';
  const tsx = 'apps/desktop/src/features/x/Row.tsx';

  it('flags margin classes, ml-auto and negative margins in tsx and css', () => {
    assert.equal(count({ id, path: tsx, text: '<div className="mt-2 flex">' }), 1);
    assert.equal(count({ id, path: tsx, text: '<span className="ml-auto text-meta">' }), 1);
    assert.equal(count({ id, path: tsx, text: '<div className="flex -mx-2 gap-1">' }), 1);
    assert.equal(count({ id, path: tsx, text: '<div className="hover:mb-1 sm:m-3">' }), 1);
    assert.equal(count({ id, path: 'apps/desktop/src/styles.css', text: '  @apply mt-2;' }), 1);
  });

  it('leaves a one or two pixel nudge to optical-nudge', () => {
    assert.equal(count({ id, path: tsx, text: '<Icon className="mt-0.5 shrink-0" />' }), 0);
    assert.equal(count({ id, path: tsx, text: '<Icon className="-mt-px" />' }), 0);
    assert.equal(count({ id, path: tsx, text: '<Icon className="mt-0.5 ml-2" />' }), 1);
  });

  it('allows gap, padding, centering and look-alike words', () => {
    assert.equal(count({ id, path: tsx, text: '<div className="flex gap-2 p-2">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="mx-auto max-w-prose">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="item-3 system-2 data-m-2">' }), 0);
    assert.equal(count({ id, path: tsx, text: "const mt = 'margin';" }), 0);
  });
});

describe('optical-nudge', () => {
  const id = 'optical-nudge';
  const tsx = 'apps/desktop/src/features/x/Row.tsx';

  it('flags a half-step or one pixel margin on one side', () => {
    assert.equal(count({ id, path: tsx, text: '<Icon className="mt-0.5 shrink-0" />' }), 1);
    assert.equal(count({ id, path: tsx, text: '<Icon className="-mt-px" />' }), 1);
    assert.equal(count({ id, path: tsx, text: "cond && 'mb-0.5'" }), 1);
  });

  it('leaves a real spacer and look-alike words alone', () => {
    assert.equal(count({ id, path: tsx, text: '<div className="mt-2 flex">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="mt-1.5">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="gap-0.5">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="mx-0.5">' }), 0);
  });
});

describe('hook-folder', () => {
  const id = 'hook-folder';

  it('flags a flat hook file', () => {
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/useFoo.ts', text: '' }), 1);
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/hooks/useFoo.tsx', text: '' }), 1);
    assert.equal(count({ id, path: 'packages/ui/src/useCopyLink.ts', text: '' }), 1);
  });

  it('allows a hook folder and the sibling of its component', () => {
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/useFoo/index.ts', text: '' }), 0);
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/Panel/usePanel.ts', text: '' }), 0);
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/useless.ts', text: '' }), 0);
    assert.equal(count({ id, path: 'apps/desktop/src/features/x/useFoo.test.ts', text: '' }), 0);
  });

  it('knows the sibling rule from the path alone', () => {
    assert.equal(isFlatHook({ path: 'a/Panel/usePanel.ts' }), false);
    assert.equal(isFlatHook({ path: 'a/Other/usePanel.ts' }), true);
  });
});

describe('props-named-props', () => {
  const id = 'props-named-props';

  it('flags a local type named after the component, flat or in a folder', () => {
    assert.equal(
      count({ id, path: 'apps/desktop/src/features/x/Card.tsx', text: 'type CardProps = {\n};' }),
      1,
    );
    assert.equal(
      count({
        id,
        path: 'website/src/components/Card/index.tsx',
        text: 'type CardProps = {\n};',
      }),
      1,
    );
  });

  it('allows Props, an exported public type and another name', () => {
    assert.equal(
      count({ id, path: 'apps/desktop/src/features/x/Card.tsx', text: 'type Props = {\n};' }),
      0,
    );
    assert.equal(
      count({
        id,
        path: 'apps/desktop/src/features/x/Card.tsx',
        text: 'export type CardProps = {\n};',
      }),
      0,
    );
    assert.equal(
      count({ id, path: 'apps/desktop/src/features/x/Card.tsx', text: 'type RowProps = {\n};' }),
      0,
    );
    assert.equal(
      count({ id, path: 'apps/desktop/src/features/x/card.ts', text: 'type cardProps = {\n};' }),
      0,
    );
  });
});

describe('comment and em-dash reach tests, css, scripts and the website', () => {
  it('flags a comment in a test, css, a script and the website', () => {
    assert.equal(
      count({ id: 'comment', path: 'apps/desktop/src/a.test.ts', text: 'const a = 1; // why' }),
      1,
    );
    assert.equal(
      count({ id: 'comment', path: 'apps/desktop/src/styles.css', text: '/* note */' }),
      1,
    );
    assert.equal(count({ id: 'comment', path: 'scripts/a.mjs', text: '// note' }), 1);
    assert.equal(count({ id: 'comment', path: 'website/src/a.tsx', text: '// note' }), 1);
  });

  it('allows a vitest pragma, a url and a string', () => {
    assert.equal(
      count({
        id: 'comment',
        path: 'apps/desktop/src/a.test.ts',
        text: '// @vitest-environment node',
      }),
      0,
    );
    assert.equal(
      count({ id: 'comment', path: 'scripts/a.mjs', text: "const u = 'https://x.dev';" }),
      0,
    );
    assert.equal(
      count({ id: 'comment', path: 'apps/desktop/src/styles.css', text: '.a { color: red; }' }),
      0,
    );
  });

  it('flags an em dash in a test, css and a script', () => {
    const line = `a ${EM_DASH} b`;
    assert.equal(count({ id: 'em-dash', path: 'apps/desktop/src/a.test.ts', text: line }), 1);
    assert.equal(count({ id: 'em-dash', path: 'apps/desktop/src/styles.css', text: line }), 1);
    assert.equal(count({ id: 'em-dash', path: 'scripts/a.mjs', text: line }), 1);
    assert.equal(count({ id: 'em-dash', path: 'scripts/a.mjs', text: 'a - b' }), 0);
  });

  it('flags an en dash as well as an em dash', () => {
    const line = `a ${EN_DASH} b`;
    assert.equal(count({ id: 'em-dash', path: 'apps/desktop/src/a.ts', text: line }), 1);
    assert.equal(count({ id: 'em-dash', path: 'apps/desktop/src/a.ts', text: 'a-b' }), 0);
  });

  it('flags a dash in markdown and json, and not a hyphen', () => {
    for (const dash of [EM_DASH, EN_DASH]) {
      const line = `a ${dash} b`;
      assert.equal(count({ id: 'em-dash', path: 'docs/a.md', text: line }), 1);
      assert.equal(count({ id: 'em-dash', path: 'README.md', text: line }), 1);
      assert.equal(count({ id: 'em-dash', path: 'apps/desktop/src/a.json', text: line }), 1);
    }
    assert.equal(count({ id: 'em-dash', path: 'docs/a.md', text: 'a - b' }), 0);
    assert.equal(classifyPath({ path: 'docs/a.md' }).kind, 'doc');
    assert.equal(classifyPath({ path: 'package.json' }).kind, 'data');
  });

  it('does not apply the other rules to tests or scripts', () => {
    assert.equal(
      count({ id: 'else-branch', path: 'apps/desktop/src/a.test.ts', text: '} else {' }),
      0,
    );
    assert.equal(count({ id: 'else-branch', path: 'scripts/a.mjs', text: '} else {' }), 0);
    assert.equal(count({ id: 'else-branch', path: 'website/src/a.ts', text: '} else {' }), 1);
  });
});

describe('ledgers', () => {
  it('keeps core sources of an old rule in the core ledger and the rest in guards', () => {
    const elseRule = rule({ id: 'else-branch' });
    const core = readSource({ path: 'apps/desktop/src/a.ts', text: '' });
    const website = readSource({ path: 'website/src/a.ts', text: '' });
    assert.equal(ledgerOf({ rule: elseRule, file: core }), 'core');
    assert.equal(ledgerOf({ rule: elseRule, file: website }), 'guards');
    assert.equal(ledgerOf({ rule: rule({ id: 'rust-else' }), file: core }), 'guards');
  });

  it('lists the lines of a line rule', () => {
    const file = readSource({
      path: 'apps/desktop/src-tauri/src/a.rs',
      text: 'a\n} else {\nb\n} else {',
    });
    assert.deepEqual(matchedLineNumbers({ rule: rule({ id: 'rust-else' }), file }), [2, 4]);
  });
});

describe('edge inputs', () => {
  const path = 'apps/desktop/src/features/x/Row.tsx';

  it('survives empty, whitespace only and carriage return input', () => {
    for (const candidate of RULES) {
      for (const text of ['', '   \n\t\n', 'a\r\nb\r\n']) {
        const file = readSource({ path, text });
        assert.equal(
          countFor({ rule: candidate, file }),
          0,
          `${candidate.id} on ${JSON.stringify(text)}`,
        );
      }
    }
  });

  it('survives a 100k character line', () => {
    const text = `const a = "${'x'.repeat(100000)}";`;
    for (const candidate of RULES) {
      assert.equal(countFor({ rule: candidate, file: readSource({ path, text }) }), 0);
    }
  });
});

describe('a rule with its own ledger', () => {
  const own = {
    id: 'ledger-core-probe',
    kinds: ['ts'],
    ledger: 'own',
    count: (file) => file.lines.filter((line) => line.includes('probe')).length,
  };
  const sources = [
    readSource({ path: 'apps/desktop/src/a.ts', text: 'probe\nprobe\n' }),
    readSource({ path: 'apps/desktop/src/b.ts', text: 'const a = 1;\n' }),
  ];

  it('writes the rule to a file of its own and keeps it out of the shared ledgers', () => {
    const ledgers = measure({ sources, rules: [own] });
    assert.deepEqual(ledgers['rule:ledger-core-probe'], {
      'ledger-core-probe': { 'apps/desktop/src/a.ts': 2 },
    });
    assert.equal(ledgers.core['ledger-core-probe'], undefined);
    assert.equal(ledgers.guards['ledger-core-probe'], undefined);
  });

  it('names the file after the rule, beside the others', () => {
    assert.match(
      ledgerPath({ ledger: 'rule:ledger-core-probe' }),
      /regressions.forbidden-patterns[.]ledger-core-probe[.]baseline[.]json$/,
    );
  });

  it('reads a missing ledger as zero, so the diff shows the first measured count', () => {
    const counts = measure({ sources, rules: [own] });
    const grown = grownOffenses({ counts, baselines: {} });
    assert.equal(grown.length, 1);
    assert.equal(grown[0].allowed, 0);
  });
});

describe('shrunkOffenses', () => {
  const baselines = { core: { 'else-branch': { 'a.ts': 3, 'gone.ts': 1, 'same.ts': 2 } } };

  it('names a file below its baseline and a file that left', () => {
    const counts = { core: { 'else-branch': { 'a.ts': 1, 'same.ts': 2 } } };
    assert.deepEqual(shrunkOffenses({ counts, baselines }), [
      { ruleId: 'else-branch', path: 'a.ts', count: 1, allowed: 3 },
      { ruleId: 'else-branch', path: 'gone.ts', count: 0, allowed: 1 },
    ]);
  });

  it('says nothing when counts match or grew', () => {
    const counts = { core: { 'else-branch': { 'a.ts': 3, 'gone.ts': 1, 'same.ts': 5 } } };
    assert.deepEqual(shrunkOffenses({ counts, baselines }), []);
  });
});

const TS = 'apps/desktop/src/features/x/a.ts';
const TSX = 'apps/desktop/src/features/x/Row.tsx';
const TAURI_CORE = '@tauri-apps/api/core';
const FIXTURES = {
  'else-branch': { path: TS, flagged: '} else {', allowed: 'if (a) {' },
  'extra-component-per-file': {
    path: TSX,
    flagged: 'const Row = () => 1;\nconst Cell = () => 2;',
    allowed: 'const Row = () => 1;\nconst helper = () => 2;',
  },
  'function-component': { path: TSX, flagged: 'function Row() {', allowed: 'const Row = () => 1;' },
  comment: { path: TS, flagged: 'const a = 1; // note', allowed: "const a = 'https://x';" },
  'config-comment': { path: 'lefthook.yml', flagged: '# note', allowed: 'pre-commit:' },
  'em-dash': { path: TS, flagged: `const a = 'x${EM_DASH}y';`, allowed: "const a = 'x-y';" },
  interface: { path: TS, flagged: 'interface Row {', allowed: 'type Row = {' },
  'export-function': {
    path: TS,
    flagged: 'export function f() {',
    allowed: 'export const f = () => 1;',
  },
  'export-default': { path: TS, flagged: 'export default f;', allowed: 'export const f = 1;' },
  any: { path: TS, flagged: 'const a: any = 1;', allowed: 'const a: unknown = 1;' },
  'invoke-in-component-or-hook': {
    path: 'apps/desktop/src/features/x/components/Row.tsx',
    flagged: `import { invoke } from '${TAURI_CORE}';`,
    allowed: "import { listen } from '@tauri-apps/api/event';",
  },
  'raw-tauri-invoke': {
    path: TS,
    flagged: `import { invoke } from '${TAURI_CORE}';`,
    allowed: "import { listen } from '@tauri-apps/api/event';",
  },
  'stringified-error': {
    path: TS,
    flagged: 'try {\n  run();\n} catch (error) {\n  show(String(error));\n}',
    allowed: 'try {\n  run();\n} catch (error) {\n  show(formatError(error));\n}',
  },
  'raw-font-weight': { path: TS, flagged: "'font-medium'", allowed: "'text-row'" },
  'raw-leading': { path: TS, flagged: "'leading-relaxed'", allowed: "'text-prose'" },
  'raw-tracking': { path: TS, flagged: "'tracking-wide'", allowed: "'text-eyebrow'" },
  'raw-scroller': { path: TS, flagged: "'overflow-y-auto'", allowed: "'overflow-hidden'" },
  'tone-border-rail': { path: TS, flagged: "'rounded-md border-l-2'", allowed: "'border-l-2'" },
  'footer-cta-bar': { path: TSX, flagged: '<footer className="x">', allowed: '<FormActions />' },
  'half-step-spacing': { path: TS, flagged: "'p-1.5'", allowed: "'p-2'" },
  'role-weight-override': { path: TS, flagged: "'text-row font-medium'", allowed: "'text-row'" },
  'if-without-braces': {
    path: TS,
    flagged: 'if (a) ids.add(a);',
    allowed: 'if (a) {\n  run();\n}',
  },
  'unused-import': {
    path: TS,
    flagged: "import { a } from './x';\nexport const b = 1;",
    allowed: "import { a } from './x';\nexport const b = a;",
  },
  'param-shape': {
    path: TS,
    flagged: 'const f = ({ id }: { id: string }) => id;',
    allowed: 'const f = ({ id }: Params) => id;',
  },
  'boolean-name': {
    path: TS,
    flagged: 'type Row = { mode: boolean | null };',
    allowed: 'type Row = { isMode: boolean | null };',
  },
  'entity-keyed-setting': {
    path: TS,
    flagged: 'const key = `chat.default_model.${workspaceId}`;',
    allowed: "const key = 'chat.default_model';",
  },
  'rust-else': { path: 'apps/desktop/src-tauri/src/a.rs', flagged: '} else {', allowed: 'if a {' },
  'sibling-margin': { path: TS, flagged: "'mt-2'", allowed: "'gap-2'" },
  'optical-nudge': { path: TS, flagged: "'mt-0.5'", allowed: "'mt-2'" },
  'hook-folder': {
    path: 'apps/desktop/src/features/x/useThing.ts',
    allowedPath: 'apps/desktop/src/features/x/useThing/index.ts',
    flagged: 'export const useThing = () => 1;',
    allowed: 'export const useThing = () => 1;',
  },
  'props-named-props': {
    path: TSX,
    flagged: 'type RowProps = { a: string };',
    allowed: 'type Props = { a: string };',
  },
};

describe('every rule id has a flagged and an allowed case', () => {
  it('lists no id twice and no id the table lacks', () => {
    const ids = RULES.map((candidate) => candidate.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(Object.keys(FIXTURES).sort(), [...ids].sort());
  });

  for (const { id } of RULES) {
    it(`${id} flags its case and allows its twin`, () => {
      const fixture = FIXTURES[id];
      assert.notEqual(fixture, undefined, `${id} needs a fixture`);
      const { path, allowedPath = path, flagged, allowed } = fixture;
      assert.ok(count({ id, path, text: flagged }) > 0, `${id} flags ${flagged}`);
      assert.equal(count({ id, path: allowedPath, text: allowed }), 0, `${id} allows ${allowed}`);
    });
  }
});
