import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyPath,
  countFor,
  isFlatHook,
  ledgerOf,
  matchedLineNumbers,
  RULES,
  readSource,
} from './forbiddenPatterns.mjs';

const EM_DASH = String.fromCharCode(0x2014);

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
    assert.equal(classifyPath({ path: 'docs/a.md' }), null);
    assert.equal(classifyPath({ path: 'pnpm-lock.yaml' }), null);
    assert.equal(classifyPath({ path: 'scripts/a.json' }), null);
  });
});

describe('inline-object-param', () => {
  const path = 'apps/desktop/src/features/x/a.ts';
  const id = 'inline-object-param';

  it('flags a one-line signature with an inline object type', () => {
    assert.equal(count({ id, path, text: 'export const f = ({ id }: { id: string }) => id;' }), 1);
    assert.equal(
      count({ id, path, text: 'const g = (params: { readonly ms: number }): void => {};' }),
      1,
    );
    assert.equal(count({ id, path, text: 'const h = async ({ a }: Readonly<{ a: 1 }>) => a;' }), 1);
  });

  it('allows a named type, a positional primitive and an object literal', () => {
    assert.equal(count({ id, path, text: 'export const f = ({ id }: Params) => id;' }), 0);
    assert.equal(count({ id, path, text: 'const g = (value: string) => value;' }), 0);
    assert.equal(count({ id, path, text: 'run({ a: { b: 1 } });' }), 0);
    assert.equal(count({ id, path, text: "const text = '({ a }: { a: 1 })';" }), 0);
    assert.equal(count({ id, path, text: 'const pick = (flag ? one : { two });' }), 0);
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

describe('positional-param', () => {
  const path = 'packages/db/src/queries/session.ts';
  const id = 'positional-param';

  it('flags db as the first positional parameter, on one line or two', () => {
    assert.equal(
      count({ id, path, text: 'export const getX = async (db: Database, id: string) => {' }),
      1,
    );
    assert.equal(count({ id, path, text: 'const helper = (db, id) => id;' }), 1);
    assert.equal(
      count({
        id,
        path,
        text: 'export const listX = async (\n  db: Database,\n  id: string,\n) => {',
      }),
      1,
    );
  });

  it('allows the params object and other folders', () => {
    assert.equal(
      count({ id, path, text: 'export const getX = async ({ db, id }: Params) => {' }),
      0,
    );
    assert.equal(
      count({ id, path, text: 'export const getX = async (\n  {\n    db,\n  }: Params,\n) => {' }),
      0,
    );
    assert.equal(
      count({
        id,
        path: 'packages/db/src/client.ts',
        text: 'export const open = (db: Database) => db;',
      }),
      0,
    );
  });
});

describe('boolean-prefix', () => {
  const path = 'apps/desktop/src/features/x/Panel.tsx';
  const id = 'boolean-prefix';

  it('flags useState and a prop typed boolean without a prefix', () => {
    assert.equal(count({ id, path, text: 'const [open, setOpen] = useState<boolean>(false);' }), 1);
    assert.equal(count({ id, path, text: 'const [busy, setBusy] = useState(false);' }), 1);
    assert.equal(count({ id, path, text: 'type Props = {\n  readonly open: boolean;\n};' }), 1);
    assert.equal(count({ id, path, text: 'type Props = {\n  disabled?: boolean,\n};' }), 1);
  });

  it('allows the prefixes and other shapes', () => {
    assert.equal(
      count({ id, path, text: 'const [isOpen, setOpen] = useState<boolean>(false);' }),
      0,
    );
    assert.equal(count({ id, path, text: 'const [hasError, set] = useState(false);' }), 0);
    assert.equal(count({ id, path, text: 'type Props = {\n  readonly canSend: boolean;\n};' }), 0);
    assert.equal(
      count({ id, path, text: 'type Props = {\n  readonly shouldFocus?: boolean;\n};' }),
      0,
    );
    assert.equal(count({ id, path, text: 'const [name, setName] = useState<string>("");' }), 0);
    assert.equal(count({ id, path, text: 'onChange: (value: boolean) => void;' }), 0);
    assert.equal(count({ id, path, text: 'type Props = {\n  mode: boolean | null;\n};' }), 0);
  });

  it('reads members only in a tsx file', () => {
    assert.equal(
      count({
        id,
        path: 'apps/desktop/src/features/x/row.ts',
        text: 'type Row = {\n  archived: boolean;\n};',
      }),
      0,
    );
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

  it('allows gap, padding, centering and look-alike words', () => {
    assert.equal(count({ id, path: tsx, text: '<div className="flex gap-2 p-2">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="mx-auto max-w-prose">' }), 0);
    assert.equal(count({ id, path: tsx, text: '<div className="item-3 system-2 data-m-2">' }), 0);
    assert.equal(count({ id, path: tsx, text: "const mt = 'margin';" }), 0);
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
