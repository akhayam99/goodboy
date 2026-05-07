import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@kay-am/types';
import { parseStreamJsonLine, type ParseContext } from './parser';

const at = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
};

function parse(line: string): ReadonlyArray<TurnEvent> {
  return parseStreamJsonLine(line, ctx);
}

describe('parseStreamJsonLine', () => {
  it('returns nothing for empty / blank lines', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   ')).toEqual([]);
  });

  it('returns nothing for malformed json', () => {
    expect(parse('{not json')).toEqual([]);
  });

  it('ignores system events', () => {
    expect(parse(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([]);
  });

  it('emits assistant_text for text content blocks', () => {
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'hello' }],
        },
      }),
    );
    expect(events).toEqual([{ kind: 'assistant_text', runId: ctx.runId, delta: 'hello', at }]);
  });

  it('emits tool_call_start for tool_use blocks', () => {
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'Bash',
              input: { command: 'ls' },
            },
          ],
        },
      }),
    );
    expect(events).toEqual([
      {
        kind: 'tool_call_start',
        runId: ctx.runId,
        toolUseId: 'tool_1',
        toolName: 'Bash',
        input: { command: 'ls' },
        at,
      },
    ]);
  });

  it('also emits file_edit for Write tool', () => {
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'Write',
              input: { file_path: '/tmp/x.ts' },
            },
          ],
        },
      }),
    );
    expect(events.some((e) => e.kind === 'file_edit')).toBe(true);
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/x.ts', editType: 'create' });
  });

  it('emits modify for Edit tool', () => {
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'Edit',
              input: { file_path: '/tmp/x.ts', old_string: 'a', new_string: 'b' },
            },
          ],
        },
      }),
    );
    const edit = events.find((e) => e.kind === 'file_edit');
    expect(edit).toMatchObject({ path: '/tmp/x.ts', editType: 'modify' });
  });

  it('emits tool_call_end for user tool_result blocks', () => {
    const events = parse(
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              content: 'output',
              is_error: false,
            },
          ],
        },
      }),
    );
    expect(events[0]).toMatchObject({
      kind: 'tool_call_end',
      toolUseId: 'tool_1',
      output: 'output',
      isError: false,
    });
  });

  it('emits usage + done from result success', () => {
    const events = parse(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'usage',
      usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 2 },
    });
    expect(events[1]).toMatchObject({ kind: 'done' });
  });

  it('emits error from result with error message', () => {
    const events = parse(JSON.stringify({ type: 'result', subtype: 'error', error: 'rate limit' }));
    const error = events.find((e) => e.kind === 'error');
    expect(error).toMatchObject({ kind: 'error', message: 'rate limit' });
  });

  it('emits unknown_payload for unrecognised payload types', () => {
    const raw = { type: 'ping', extra: 42 };
    const events = parse(JSON.stringify(raw));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'unknown_payload',
      runId: ctx.runId,
      adapter: 'anthropic',
      payloadType: 'ping',
      raw,
      at,
    });
  });

  it('calls onUnknown hook for unrecognised payload types', () => {
    const onUnknown = vi.fn();
    const raw = { type: 'debug_trace', data: 'x' };
    parseStreamJsonLine(JSON.stringify(raw), { ...ctx, onUnknown });
    expect(onUnknown).toHaveBeenCalledWith('debug_trace', raw);
  });
});
