// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { joinTitleLines } from './BuilderTitleField';

describe('joinTitleLines', () => {
  it('keeps a single line as typed', () => {
    expect(joinTitleLines({ text: '  Settle the ledger ' })).toBe('  Settle the ledger ');
  });

  it('joins pasted lines with one space', () => {
    expect(joinTitleLines({ text: 'Settle the \n  ledger' })).toBe('Settle the ledger');
    expect(joinTitleLines({ text: 'Settle\r\n\n \nthe ledger' })).toBe('Settle the ledger');
  });

  it('joins two long runs of whitespace around a line break', () => {
    expect(joinTitleLines({ text: `${' '.repeat(50_000)}\n${' '.repeat(50_000)}x` })).toBe(' x');
  });
});
