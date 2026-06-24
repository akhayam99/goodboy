import { describe, expect, it } from 'vitest';
import { highlightLine, languageForPath, type SyntaxKind, type SyntaxLang } from './index';

const ALL_LANGS: ReadonlyArray<SyntaxLang> = [
  'ts',
  'js',
  'json',
  'css',
  'rust',
  'python',
  'go',
  'shell',
  'markdown',
  'yaml',
  'toml',
  'html',
];

const CORPUS: ReadonlyArray<string> = [
  '',
  '   ',
  '\t\t',
  'const x = 42;',
  'export const fn = (a: number): string => `hi ${a}`;',
  'import { foo } from "./bar";',
  '// a comment with "quotes" and 42',
  '/* inline block */ let y = 0x1F;',
  "const s = 'it\\'s escaped';",
  'type MyType = { a: number };',
  'foo.bar.baz();',
  '<Component prop="x" />',
  'if (a && b || !c) { return; }',
  '{ "key": "value", "n": -3.14, "ok": true, "z": null }',
  '.btn-primary { color: #fff; margin: 10px; }',
  '@media (max-width: 600px) { body { font-size: 1.2rem; } }',
  'fn main() { let mut v: Vec<u32> = vec![1, 2, 3]; }',
  'pub struct Point { x: f64 }',
  'println!("hello {}", name);',
  'def greet(name: str) -> None:',
  'x = [i for i in range(10) if i % 2 == 0]',
  "s = f'value is {x!r}'",
  'value = True if cond else None',
  'func Add(a int, b int) int { return a + b }',
  'package main',
  'var ch chan int = make(chan int)',
  'msg := `raw string`',
  'if [ -f "$HOME/.bashrc" ]; then echo "$VAR"; fi',
  'for i in ${list[@]}; do done',
  'export PATH=/usr/bin:$PATH',
  '# Heading one',
  '## Heading two with `code`',
  '- list item with **bold** and *em*',
  'see [link](https://example.com) here',
  'key: value',
  '  nested: true',
  '- item: 42',
  '# yaml comment',
  'name: "quoted string"',
  '[section]',
  '[[array.of.tables]]',
  'enabled = true',
  'port = 8080 # trailing comment',
  '<div class="container" id="main">',
  '<!-- html comment -->',
  '</section>',
  '<img src="a.png" alt="text" />',
  'plain text with no markup whatsoever',
  '   leading and trailing whitespace   ',
  'a\tb\tc',
  '中文 unicode ❤️ test',
];

const join = (text: string, lang: SyntaxLang | null): string =>
  highlightLine(text, lang)
    .map((t) => t.text)
    .join('');

const kindOf = (text: string, lang: SyntaxLang, fragment: string): SyntaxKind | undefined =>
  highlightLine(text, lang).find((t) => t.text === fragment)?.kind;

describe('highlightLine lossless invariant', () => {
  for (const lang of ALL_LANGS) {
    it(`round-trips every corpus line for ${lang}`, () => {
      for (const line of CORPUS) {
        expect(join(line, lang)).toBe(line);
      }
    });
  }

  it('round-trips for null lang', () => {
    for (const line of CORPUS) {
      expect(join(line, null)).toBe(line);
    }
  });

  it('never emits empty tokens', () => {
    for (const lang of [...ALL_LANGS, null] as ReadonlyArray<SyntaxLang | null>) {
      for (const line of CORPUS) {
        for (const token of highlightLine(line, lang)) {
          expect(token.text.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe('highlightLine edge cases', () => {
  it('returns [] for empty input on every lang', () => {
    for (const lang of [...ALL_LANGS, null] as ReadonlyArray<SyntaxLang | null>) {
      expect(highlightLine('', lang)).toEqual([]);
    }
  });

  it('emits a single plain token for null lang', () => {
    expect(highlightLine('anything here', null)).toEqual([
      { text: 'anything here', kind: 'plain' },
    ]);
  });

  it('treats pure whitespace as plain', () => {
    const tokens = highlightLine('   \t  ', 'ts');
    expect(tokens.every((t) => t.kind === 'plain')).toBe(true);
    expect(tokens.map((t) => t.text).join('')).toBe('   \t  ');
  });

  it('handles escaped quotes without dropping characters', () => {
    const src = "const s = 'it\\'s ok';";
    expect(join(src, 'ts')).toBe(src);
    expect(kindOf(src, 'ts', "'it\\'s ok'")).toBe('string');
  });
});

describe('languageForPath', () => {
  it('maps known extensions', () => {
    expect(languageForPath('a/b/c.ts')).toBe('ts');
    expect(languageForPath('x.tsx')).toBe('ts');
    expect(languageForPath('x.rs')).toBe('rust');
    expect(languageForPath('x.py')).toBe('python');
    expect(languageForPath('Cargo.toml')).toBe('toml');
    expect(languageForPath('x.YAML')).toBe('yaml');
  });

  it('returns null for unknown or extensionless', () => {
    expect(languageForPath('Makefile')).toBeNull();
    expect(languageForPath('x.unknownext')).toBeNull();
  });
});

describe('ts/js tokenizer', () => {
  it('marks import as keyword', () => {
    expect(kindOf('import x from "y";', 'ts', 'import')).toBe('keyword');
  });

  it('marks string literals', () => {
    expect(kindOf('const a = "hi";', 'ts', '"hi"')).toBe('string');
  });

  it('marks template literals as string', () => {
    expect(kindOf('const a = `hi`;', 'ts', '`hi`')).toBe('string');
  });

  it('marks numbers including hex', () => {
    expect(kindOf('let n = 42;', 'ts', '42')).toBe('number');
    expect(kindOf('let n = 0xFF;', 'ts', '0xFF')).toBe('number');
  });

  it('marks line comments', () => {
    expect(kindOf('// hello', 'ts', '// hello')).toBe('comment');
  });

  it('marks block comments inline', () => {
    expect(kindOf('a /* b */ c', 'ts', '/* b */')).toBe('comment');
  });

  it('marks Capitalized identifiers as type', () => {
    expect(kindOf('let x: MyType;', 'ts', 'MyType')).toBe('type');
  });

  it('marks call target as function', () => {
    expect(kindOf('foo(1)', 'ts', 'foo')).toBe('function');
  });

  it('marks member after dot as property', () => {
    expect(kindOf('a.bar = 1', 'ts', 'bar')).toBe('property');
  });

  it('marks true/null as constant', () => {
    expect(kindOf('x = true', 'ts', 'true')).toBe('constant');
    expect(kindOf('x = null', 'ts', 'null')).toBe('constant');
  });

  it('marks ts-only keywords', () => {
    expect(kindOf('interface Foo {}', 'ts', 'interface')).toBe('keyword');
    expect(kindOf('type T = A;', 'ts', 'type')).toBe('keyword');
  });

  it('does not treat type as keyword in plain js', () => {
    expect(kindOf('type = 1', 'js', 'type')).not.toBe('keyword');
  });

  it('marks JSX tag names', () => {
    expect(kindOf('<Box />', 'ts', 'Box')).toBe('tag');
  });
});

describe('json tokenizer', () => {
  it('distinguishes key from value strings', () => {
    const src = '{ "key": "value" }';
    expect(kindOf(src, 'json', '"key"')).toBe('property');
    expect(kindOf(src, 'json', '"value"')).toBe('string');
  });

  it('marks numbers and constants', () => {
    const src = '{ "n": -3.5, "b": false }';
    expect(kindOf(src, 'json', '-3.5')).toBe('number');
    expect(kindOf(src, 'json', 'false')).toBe('constant');
  });
});

describe('css tokenizer', () => {
  it('marks property names before colon', () => {
    expect(kindOf('color: red;', 'css', 'color')).toBe('property');
  });

  it('marks at-rules as keyword', () => {
    expect(kindOf('@media screen {', 'css', '@media')).toBe('keyword');
  });

  it('marks comments and numbers with units', () => {
    expect(kindOf('/* c */ a: 1px;', 'css', '/* c */')).toBe('comment');
    expect(kindOf('a: 12px;', 'css', '12px')).toBe('number');
  });
});

describe('rust tokenizer', () => {
  it('marks fn and struct as keyword', () => {
    expect(kindOf('fn main() {}', 'rust', 'fn')).toBe('keyword');
    expect(kindOf('struct S {}', 'rust', 'struct')).toBe('keyword');
  });

  it('marks macros as function', () => {
    expect(kindOf('println!("x")', 'rust', 'println')).toBe('function');
  });

  it('marks char literals as string', () => {
    expect(kindOf("let c = 'a';", 'rust', "'a'")).toBe('string');
  });
});

describe('python tokenizer', () => {
  it('marks def as keyword', () => {
    expect(kindOf('def f():', 'python', 'def')).toBe('keyword');
  });

  it('marks None/True as constant', () => {
    expect(kindOf('x = None', 'python', 'None')).toBe('constant');
    expect(kindOf('x = True', 'python', 'True')).toBe('constant');
  });

  it('marks comments', () => {
    expect(kindOf('# note', 'python', '# note')).toBe('comment');
  });

  it('marks call target as function', () => {
    expect(kindOf('print(x)', 'python', 'print')).toBe('function');
  });
});

describe('go tokenizer', () => {
  it('marks func and package as keyword', () => {
    expect(kindOf('func main() {}', 'go', 'func')).toBe('keyword');
    expect(kindOf('package main', 'go', 'package')).toBe('keyword');
  });

  it('marks raw backtick strings', () => {
    expect(kindOf('s := `raw`', 'go', '`raw`')).toBe('string');
  });

  it('marks nil as constant', () => {
    expect(kindOf('x = nil', 'go', 'nil')).toBe('constant');
  });
});

describe('shell tokenizer', () => {
  it('marks keywords', () => {
    expect(kindOf('if true; then', 'shell', 'if')).toBe('keyword');
  });

  it('marks variables', () => {
    expect(kindOf('echo $HOME', 'shell', '$HOME')).toBe('property');
    expect(kindOf('echo ${X}', 'shell', '${X}')).toBe('property');
  });

  it('marks comments', () => {
    expect(kindOf('# comment', 'shell', '# comment')).toBe('comment');
  });
});

describe('markdown tokenizer', () => {
  it('marks heading marker as keyword', () => {
    const tokens = highlightLine('# Title', 'markdown');
    expect(tokens[0]?.kind).toBe('keyword');
  });

  it('marks inline code as string', () => {
    expect(kindOf('use `code` here', 'markdown', '`code`')).toBe('string');
  });
});

describe('yaml tokenizer', () => {
  it('marks key as property', () => {
    expect(kindOf('name: value', 'yaml', 'name')).toBe('property');
  });

  it('marks booleans as constant', () => {
    expect(kindOf('flag: true', 'yaml', 'true')).toBe('constant');
  });

  it('marks comments', () => {
    expect(kindOf('# yaml', 'yaml', '# yaml')).toBe('comment');
  });
});

describe('toml tokenizer', () => {
  it('marks sections as type', () => {
    expect(kindOf('[server]', 'toml', '[server]')).toBe('type');
  });

  it('marks key as property and bool as constant', () => {
    expect(kindOf('enabled = true', 'toml', 'enabled')).toBe('property');
    expect(kindOf('enabled = true', 'toml', 'true')).toBe('constant');
  });
});

describe('html tokenizer', () => {
  it('marks tag names', () => {
    expect(kindOf('<div>', 'html', 'div')).toBe('tag');
  });

  it('marks attribute names and values', () => {
    const src = '<a href="x">';
    expect(kindOf(src, 'html', 'href')).toBe('property');
    expect(kindOf(src, 'html', '"x"')).toBe('string');
  });

  it('marks comments', () => {
    expect(kindOf('<!-- c -->', 'html', '<!-- c -->')).toBe('comment');
  });
});
