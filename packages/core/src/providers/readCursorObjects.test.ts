import { describe, expect, it } from 'vitest';
import { readCursorObjects } from './readCursorObjects';

describe('readCursorObjects', () => {
  it('decodes a well-formed single-line stream', () => {
    const stdout = '{"type":"system","subtype":"init"}\n{"type":"result","result":"done"}';

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'system', subtype: 'init' },
      { type: 'result', result: 'done' },
    ]);
  });

  it('preserves a literal line feed inside a string value', () => {
    const stdout = `{"type":"result","result":"first line
second line"}`;

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'result', result: 'first line\nsecond line' },
    ]);
  });

  it('preserves a literal carriage return and line feed inside a string value', () => {
    const carriageReturn = String.fromCharCode(13);
    const stdout = `{"type":"result","result":"first line${carriageReturn}
second line"}`;

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'result', result: 'first line\r\nsecond line' },
    ]);
  });

  it('handles escaped quotes and odd and even backslash runs before a quote', () => {
    const stdout = String.raw`{"type":"result","result":"odd \" quote and even slash \\"}{"type":"result","result":"next"}`;

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'result', result: 'odd " quote and even slash \\' },
      { type: 'result', result: 'next' },
    ]);
  });

  it('ignores braces and brackets inside string values', () => {
    const stdout = '{"type":"result","result":"text with { braces } and [ brackets ]"}';

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'result', result: 'text with { braces } and [ brackets ]' },
    ]);
  });

  it('decodes nested objects and arrays', () => {
    const stdout = '{"type":"assistant","message":{"content":[{"type":"text","text":"done"}]}}';

    expect(readCursorObjects({ stdout })).toEqual([
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'done' }] },
      },
    ]);
  });

  it('decodes adjacent complete objects without a separator', () => {
    const stdout = '{"type":"system"}{"type":"result","result":"done"}';

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'system' },
      { type: 'result', result: 'done' },
    ]);
  });

  it('ignores a truncated final object without throwing', () => {
    const stdout = '{"type":"system"}\n{"type":"result","result":"unfinished';

    expect(readCursorObjects({ stdout })).toEqual([{ type: 'system' }]);
  });

  it('ignores non-JSON diagnostic lines between events', () => {
    const stdout = `cursor starting
{"type":"system","subtype":"init"}
diagnostic output
{"type":"result","result":"done"}`;

    expect(readCursorObjects({ stdout })).toEqual([
      { type: 'system', subtype: 'init' },
      { type: 'result', result: 'done' },
    ]);
  });
});
