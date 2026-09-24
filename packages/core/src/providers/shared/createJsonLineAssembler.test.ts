import { describe, expect, it } from 'vitest';
import {
  createJsonLineAssembler,
  JSON_LINE_ASSEMBLER_MAX_HELD_LINES,
} from './createJsonLineAssembler';

describe('createJsonLineAssembler', () => {
  it('passes a complete json line through untouched', () => {
    const assembler = createJsonLineAssembler();

    expect(assembler.push({ line: '{"type":"result"}' })).toEqual({
      kind: 'line',
      line: '{"type":"result"}',
    });
  });

  it('never holds a line that is not json', () => {
    const assembler = createJsonLineAssembler();

    expect(assembler.push({ line: 'Loaded cached credentials.' })).toEqual({
      kind: 'line',
      line: 'Loaded cached credentials.',
    });
    expect(assembler.flush()).toEqual([]);
  });

  it('joins a string split by a raw newline across two lines', () => {
    const assembler = createJsonLineAssembler();

    expect(assembler.push({ line: '{"type":"text","text":"first' })).toEqual({ kind: 'pending' });
    const result = assembler.push({ line: 'second"}' });

    expect(result.kind).toBe('line');
    expect(result.kind === 'line' && JSON.parse(result.line)).toEqual({
      type: 'text',
      text: 'first\nsecond',
    });
  });

  it('joins a string split across three lines', () => {
    const assembler = createJsonLineAssembler();

    assembler.push({ line: '{"text":"one' });
    expect(assembler.push({ line: 'two' })).toEqual({ kind: 'pending' });
    const result = assembler.push({ line: 'three"}' });

    expect(result.kind === 'line' && JSON.parse(result.line)).toEqual({ text: 'one\ntwo\nthree' });
  });

  it('accepts a raw tab inside one line', () => {
    const assembler = createJsonLineAssembler();

    expect(assembler.push({ line: '{"text":"a\tb"}' })).toEqual({
      kind: 'line',
      line: '{"text":"a\tb"}',
    });
  });

  it('releases the held lines raw once the cap is reached', () => {
    const assembler = createJsonLineAssembler();

    assembler.push({ line: '{"text":"never closed' });
    const results = Array.from({ length: JSON_LINE_ASSEMBLER_MAX_HELD_LINES - 1 }, (_, index) =>
      assembler.push({ line: `fragment ${index}` }),
    );
    const last = results[results.length - 1];

    expect(last?.kind).toBe('overflow');
    expect(last?.kind === 'overflow' && last.lines.length).toBe(JSON_LINE_ASSEMBLER_MAX_HELD_LINES);
    expect(assembler.flush()).toEqual([]);
  });

  it('lets a complete line through when a truncated one is held', () => {
    const assembler = createJsonLineAssembler();

    assembler.push({ line: '{"text":"cut' });

    expect(assembler.push({ line: '{"type":"result"}' })).toEqual({
      kind: 'overflow',
      lines: ['{"text":"cut', '{"type":"result"}'],
    });
  });

  it('flushes what is still held at the end of the stream', () => {
    const assembler = createJsonLineAssembler();

    assembler.push({ line: '{"text":"dangling' });

    expect(assembler.flush()).toEqual(['{"text":"dangling']);
    expect(assembler.flush()).toEqual([]);
  });
});
