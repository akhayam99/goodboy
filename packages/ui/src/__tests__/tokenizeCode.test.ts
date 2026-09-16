import { describe, expect, it } from 'vitest';
import { tokenizeCode, type CodeToken } from '../components/Markdown/tokenizeCode';

const joined = (tokens: ReadonlyArray<CodeToken>): string =>
  tokens.map((token) => token.text).join('');

const kindsOf = (tokens: ReadonlyArray<CodeToken>, text: string): ReadonlyArray<string> =>
  tokens.filter((token) => token.text === text).map((token) => token.kind);

describe('tokenizeCode', () => {
  it('falls through to plain rendering for an unlabelled block', () => {
    expect(tokenizeCode({ code: 'anything', lang: null })).toBeNull();
  });

  it('falls through to plain rendering for a language it does not know', () => {
    expect(tokenizeCode({ code: 'anything', lang: 'brainfuck' })).toBeNull();
  });

  it('never loses or reorders a character', () => {
    const samples: ReadonlyArray<readonly [string, string]> = [
      ['ts', 'const a = "x"; // note\nreturn 42;'],
      ['json', '{ "a": 1, "b": true }'],
      ['bash', 'echo "hi" # note\nexit 1'],
      ['sql', "SELECT id FROM t WHERE name = 'x' -- note"],
      ['rust', 'fn main() { let x = 1; /* note */ }'],
      ['diff', '@@ -1 +1 @@\n-old\n+new\n context'],
    ];
    samples.forEach(([lang, code]) => {
      const tokens = tokenizeCode({ code, lang });
      expect(tokens).not.toBeNull();
      expect(joined(tokens ?? [])).toBe(code);
    });
  });

  it('marks comments, strings, numbers and keywords in typescript', () => {
    const tokens = tokenizeCode({ code: 'const a = "x"; // note\nreturn 42;', lang: 'ts' }) ?? [];
    expect(kindsOf(tokens, 'const')).toEqual(['keyword']);
    expect(kindsOf(tokens, 'return')).toEqual(['keyword']);
    expect(kindsOf(tokens, '"x"')).toEqual(['string']);
    expect(kindsOf(tokens, '// note')).toEqual(['comment']);
    expect(kindsOf(tokens, '42')).toEqual(['number']);
    expect(
      tokens
        .filter((token) => token.kind === 'plain')
        .map((token) => token.text)
        .join(''),
    ).toContain('a');
  });

  it('separates a json key from its string value', () => {
    const tokens = tokenizeCode({ code: '{ "tenant": "northwind" }', lang: 'json' }) ?? [];
    expect(kindsOf(tokens, '"tenant"')).toEqual(['property']);
    expect(kindsOf(tokens, '"northwind"')).toEqual(['string']);
  });

  it('reads a json key across a line break before the colon', () => {
    const tokens = tokenizeCode({ code: '{\n  "retries"\n  : 3\n}', lang: 'json' }) ?? [];
    expect(kindsOf(tokens, '"retries"')).toEqual(['property']);
  });

  it('leaves a typescript string alone even when a colon follows', () => {
    const tokens = tokenizeCode({ code: "const a = { 'k': 1 };", lang: 'ts' }) ?? [];
    expect(kindsOf(tokens, "'k'")).toEqual(['string']);
  });

  it('colours shell grammar but leaves builtin commands as commands', () => {
    const tokens = tokenizeCode({ code: 'if true; then echo hi; exit 0; fi', lang: 'bash' }) ?? [];
    expect(kindsOf(tokens, 'if')).toEqual(['keyword']);
    expect(kindsOf(tokens, 'then')).toEqual(['keyword']);
    expect(kindsOf(tokens, 'fi')).toEqual(['keyword']);
    expect(tokens.some((token) => token.kind === 'keyword' && token.text === 'echo')).toBe(false);
    expect(tokens.some((token) => token.kind === 'keyword' && token.text === 'exit')).toBe(false);
    expect(tokens.some((token) => token.kind === 'keyword' && token.text === 'export')).toBe(false);
  });

  it('reads sql keywords whatever their case', () => {
    const tokens = tokenizeCode({ code: 'select * from Ledger', lang: 'sql' }) ?? [];
    expect(kindsOf(tokens, 'select')).toEqual(['keyword']);
    expect(kindsOf(tokens, 'from')).toEqual(['keyword']);
    expect(tokens.some((token) => token.text === 'Ledger' && token.kind === 'keyword')).toBe(false);
  });

  it('splits a diff into added, removed and meta lines', () => {
    const tokens = tokenizeCode({ code: '@@ -1 +1 @@\n-old\n+new\n keep', lang: 'diff' }) ?? [];
    expect(tokens.map((token) => token.kind)).toEqual(['comment', 'removed', 'added', 'plain']);
  });

  it('does not read a shell parameter expansion as a comment', () => {
    const tokens = tokenizeCode({ code: 'echo $# done', lang: 'bash' }) ?? [];
    expect(tokens.some((token) => token.kind === 'comment')).toBe(false);
  });

  it('leaves an ambiguous digit run uncoloured', () => {
    const tokens = tokenizeCode({ code: 'let v = 123abc;', lang: 'ts' }) ?? [];
    expect(tokens.some((token) => token.kind === 'number')).toBe(false);
  });

  it('closes an unterminated string at the end of the block', () => {
    const code = 'const a = "open';
    const tokens = tokenizeCode({ code, lang: 'ts' }) ?? [];
    expect(joined(tokens)).toBe(code);
    expect(kindsOf(tokens, '"open')).toEqual(['string']);
  });
});
