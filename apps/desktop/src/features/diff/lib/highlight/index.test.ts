import { describe, expect, it } from 'vitest';
import { highlightCode, languageForName, languageForPath, peekHighlight } from '.';
import { SENTINEL_THEME, kindForColor } from './theme';
import { MAX_HIGHLIGHT_LINES, MAX_HIGHLIGHT_LINE_LENGTH, exceedsHighlightCap } from './tokenize';

const kindsOf = (line: ReadonlyArray<{ text: string; kind: string }> | undefined) =>
  (line ?? []).filter((token) => token.text.trim().length > 0).map((token) => token.kind);

describe('sentinel theme', () => {
  it('maps every sentinel colour back to a syntax kind', () => {
    expect(kindForColor('#000001')).toBe('keyword');
    expect(kindForColor('#00000C')).toBe('regex');
    expect(kindForColor('#000004ff')).toBe('comment');
    expect(kindForColor('#123456')).toBe('plain');
    expect(kindForColor(undefined)).toBe('plain');
  });

  it('only uses sentinel colours', () => {
    const colours = (SENTINEL_THEME.settings ?? []).map((entry) => entry.settings.foreground);
    for (const colour of colours) {
      expect(colour).toMatch(/^#00000[0-9a-c]$/);
    }
  });
});

describe('languages', () => {
  it('resolves paths and fence names', () => {
    expect(languageForPath('apps/ledger-core/src/allocate.ts')).toBe('typescript');
    expect(languageForPath('notify-relay/Dockerfile')).toBe('dockerfile');
    expect(languageForPath('payments-api/Makefile')).toBe('make');
    expect(languageForPath('README')).toBeNull();
    expect(languageForName('sh')).toBe('shellscript');
    expect(languageForName('TSX')).toBe('tsx');
    expect(languageForName('brainfuck')).toBeNull();
  });
});

describe('highlightCode', () => {
  it('keeps block comment state across lines', async () => {
    const lines = await highlightCode(
      '/* ledger-core\n still a comment */\nconst total = 1;',
      'typescript',
    );
    expect(lines).not.toBeNull();
    expect(kindsOf(lines?.[0])).toEqual(['comment']);
    expect(kindsOf(lines?.[1])).toEqual(['comment']);
    expect(kindsOf(lines?.[2])).toContain('keyword');
    expect(kindsOf(lines?.[2])).toContain('number');
  });

  it('keeps template strings open across lines', async () => {
    const lines = await highlightCode('const tag = `Northwind\nAcme`;', 'typescript');
    expect(kindsOf(lines?.[1])[0]).toBe('string');
  });

  it('round-trips the source text exactly', async () => {
    const code = 'fn main() {\n    let rate = 0.25; // Cascadia\n}';
    const lines = await highlightCode(code, 'rust');
    expect(lines?.map((line) => line.map((token) => token.text).join('')).join('\n')).toBe(code);
  });

  it('serves repeated requests from the cache', async () => {
    const code = 'SELECT id FROM ledger;';
    const first = await highlightCode(code, 'sql');
    expect(peekHighlight(code, 'sql')).toBe(first);
  });

  it('stays plain over the size cap', async () => {
    expect(exceedsHighlightCap('x'.repeat(MAX_HIGHLIGHT_LINE_LENGTH + 1))).toBe(true);
    expect(exceedsHighlightCap('a\n'.repeat(MAX_HIGHLIGHT_LINES + 1))).toBe(true);
    expect(exceedsHighlightCap('const a = 1;\nconst b = 2;')).toBe(false);
    expect(await highlightCode('y'.repeat(MAX_HIGHLIGHT_LINE_LENGTH + 5), 'typescript')).toBeNull();
  });
});
