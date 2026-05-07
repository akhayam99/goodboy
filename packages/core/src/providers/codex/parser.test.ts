import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@kay-am/types';
import { parseJsonLine, type ParseContext } from './parser';

const at = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
};

function parse(line: string, overrides?: Partial<ParseContext>) {
  return parseJsonLine(line, { ...ctx, ...overrides });
}

describe('parseJsonLine', () => {
  it('returns [] for empty / blank lines', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   ')).toEqual([]);
  });

  it('returns [] for malformed json', () => {
    expect(parse('{not json')).toEqual([]);
    expect(parse('not json at all')).toEqual([]);
  });

  it('emits assistant_text for output_text block', () => {
    const events = parse(
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'hello world' }],
      }),
    );
    expect(events).toEqual([
      { kind: 'assistant_text', runId: ctx.runId, delta: 'hello world', at },
    ]);
  });

  it('emits assistant_text for text block (alternate form)', () => {
    const events = parse(
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'assistant_text', delta: 'hi' });
  });

  it('skips message events with non-assistant role', () => {
    const events = parse(
      JSON.stringify({
        type: 'message',
        role: 'user',
        content: [{ type: 'output_text', text: 'ignored' }],
      }),
    );
    expect(events).toEqual([]);
  });

  it('skips empty text blocks', () => {
    const events = parse(
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: '' }],
      }),
    );
    expect(events).toEqual([]);
  });

  it('emits tool_call_start for function_call', () => {
    const events = parse(
      JSON.stringify({
        type: 'function_call',
        call_id: 'call_abc',
        name: 'bash',
        arguments: JSON.stringify({ command: 'ls' }),
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'tool_call_start',
      toolUseId: 'call_abc',
      toolName: 'bash',
      input: { command: 'ls' },
      at,
    });
  });

  it('emits file_edit alongside tool_call_start for write_file', () => {
    const events = parse(
      JSON.stringify({
        type: 'function_call',
        call_id: 'call_w',
        name: 'write_file',
        arguments: JSON.stringify({ path: '/tmp/x.ts', content: 'export {};' }),
      }),
    );
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/x.ts', editType: 'create' });
  });

  it('emits file_edit with modify for str_replace_editor', () => {
    const events = parse(
      JSON.stringify({
        type: 'function_call',
        call_id: 'call_e',
        name: 'str_replace_editor',
        arguments: JSON.stringify({ path: '/tmp/y.ts', old_str: 'a', new_str: 'b' }),
      }),
    );
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/y.ts', editType: 'modify' });
  });

  it('returns [] for function_call missing call_id', () => {
    const events = parse(JSON.stringify({ type: 'function_call', name: 'bash', arguments: '{}' }));
    expect(events).toEqual([]);
  });

  it('emits tool_call_end for function_call_output', () => {
    const events = parse(
      JSON.stringify({
        type: 'function_call_output',
        call_id: 'call_abc',
        output: 'file1\nfile2',
        is_error: false,
      }),
    );
    expect(events[0]).toMatchObject({
      kind: 'tool_call_end',
      toolUseId: 'call_abc',
      output: 'file1\nfile2',
      isError: false,
    });
  });

  it('marks function_call_output with is_error true', () => {
    const events = parse(
      JSON.stringify({
        type: 'function_call_output',
        call_id: 'call_abc',
        output: 'permission denied',
        is_error: true,
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'tool_call_end', isError: true });
  });

  it('returns [] for function_call_output missing call_id', () => {
    const events = parse(JSON.stringify({ type: 'function_call_output', output: 'x' }));
    expect(events).toEqual([]);
  });

  it('skips reasoning events silently', () => {
    const events = parse(
      JSON.stringify({
        type: 'reasoning',
        summary: [{ type: 'summary_text', text: 'thinking...' }],
      }),
    );
    expect(events).toEqual([]);
  });

  it('emits error event for error type', () => {
    const events = parse(JSON.stringify({ type: 'error', message: 'rate limit exceeded' }));
    expect(events[0]).toMatchObject({ kind: 'error', message: 'rate limit exceeded' });
  });

  it('calls onUnknown for unrecognized types and skips them', () => {
    const onUnknown = vi.fn();
    const events = parse(JSON.stringify({ type: 'mystery_event', payload: { x: 1 } }), {
      onUnknown,
    });
    expect(events).toEqual([]);
    expect(onUnknown).toHaveBeenCalledWith(
      'mystery_event',
      expect.objectContaining({ type: 'mystery_event' }),
    );
  });

  it('does not call onUnknown for known types', () => {
    const onUnknown = vi.fn();
    parse(JSON.stringify({ type: 'reasoning', summary: [] }), { onUnknown });
    parse(JSON.stringify({ type: 'message', role: 'assistant', content: [] }), { onUnknown });
    expect(onUnknown).not.toHaveBeenCalled();
  });
});
