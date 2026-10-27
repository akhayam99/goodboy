import { describe, expect, it } from 'vitest';
import { outputTail } from './outputTail';

const linesOf = (count: number): string =>
  Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n');

describe('outputTail', () => {
  it('keeps a short output whole', () => {
    expect(outputTail({ text: linesOf(3) })).toEqual({
      text: 'line 1\nline 2\nline 3',
      totalLines: 3,
      hiddenLines: 0,
    });
  });

  it('keeps the last 40 lines of a long output and counts the rest', () => {
    const tail = outputTail({ text: linesOf(100) });
    expect(tail.hiddenLines).toBe(60);
    expect(tail.totalLines).toBe(100);
    expect(tail.text.split('\n')).toHaveLength(40);
    expect(tail.text.startsWith('line 61')).toBe(true);
    expect(tail.text.endsWith('line 100')).toBe(true);
  });

  it('ignores the newline at the end', () => {
    expect(outputTail({ text: `${linesOf(2)}\n\n` }).totalLines).toBe(2);
  });

  it('takes a smaller window', () => {
    expect(outputTail({ text: linesOf(5), maxLines: 2 }).text).toBe('line 4\nline 5');
  });
});
