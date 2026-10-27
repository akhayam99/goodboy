import { describe, expect, it } from 'vitest';
import { bufferText, readTerminalTail, registerTerminalText } from './terminalText';

type TextBuffer = Parameters<typeof bufferText>[0]['buffer'];

type Row = {
  readonly text: string;
  readonly isWrapped?: boolean;
};

const bufferOf = (rows: ReadonlyArray<Row>): TextBuffer => ({
  length: rows.length,
  getLine: (index) => {
    const row = rows[index];
    if (row === undefined) {
      return undefined;
    }
    return { isWrapped: row.isWrapped === true, translateToString: () => row.text };
  },
});

describe('bufferText', () => {
  it('joins the rows with newlines and drops the empty rows at the end', () => {
    const text = bufferText({
      buffer: bufferOf([
        { text: '$ pnpm test' },
        { text: 'FAIL postings/rounding.test.ts' },
        { text: '' },
        { text: '' },
      ]),
    });
    expect(text).toBe('$ pnpm test\nFAIL postings/rounding.test.ts');
  });

  it('puts a wrapped row back on the line it belongs to', () => {
    const text = bufferText({
      buffer: bufferOf([
        { text: 'a very long line that the' },
        { text: ' terminal wrapped', isWrapped: true },
        { text: 'next' },
      ]),
    });
    expect(text).toBe('a very long line that the terminal wrapped\nnext');
  });

  it('keeps the blank rows in the middle', () => {
    expect(bufferText({ buffer: bufferOf([{ text: 'a' }, { text: '' }, { text: 'b' }]) })).toBe(
      'a\n\nb',
    );
  });

  it('reads an empty buffer as no text', () => {
    expect(bufferText({ buffer: bufferOf([]) })).toBe('');
  });
});

describe('readTerminalTail', () => {
  it('reads what a terminal registered and nothing after it unregisters', () => {
    const unregister = registerTerminalText({
      terminalId: 'terminal-ledger',
      reader: () => 'FAIL postings',
    });
    expect(readTerminalTail({ terminalId: 'terminal-ledger' })).toBe('FAIL postings');
    expect(readTerminalTail({ terminalId: 'terminal-other' })).toBeNull();
    unregister();
    expect(readTerminalTail({ terminalId: 'terminal-ledger' })).toBeNull();
  });

  it('keeps a newer reader when an older one unregisters late', () => {
    const first = registerTerminalText({ terminalId: 'terminal-ledger', reader: () => 'first' });
    const second = registerTerminalText({ terminalId: 'terminal-ledger', reader: () => 'second' });
    first();
    expect(readTerminalTail({ terminalId: 'terminal-ledger' })).toBe('second');
    second();
  });
});
