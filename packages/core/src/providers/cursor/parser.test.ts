import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { parseCursorStreamLine, type ParseContext } from './parser';
import { resetTextBoundary } from '../shared/text-boundary';

const at = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
};

function parse(line: string, overrides?: Partial<ParseContext>) {
  return parseCursorStreamLine(line, { ...ctx, ...overrides });
}

describe('parseCursorStreamLine', () => {
  it('returns [] for empty / blank lines', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   ')).toEqual([]);
  });

  it('returns [] for malformed json', () => {
    expect(parse('{not json')).toEqual([]);
  });

  it('ignores system events', () => {
    expect(parse(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([]);
  });

  it('emits assistant_text for text content blocks', () => {
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'hello' }] },
      }),
    );
    expect(events).toEqual([{ kind: 'assistant_text', runId: ctx.runId, delta: 'hello', at }]);
  });

  it('inserts a blank line between two text blocks separated by a tool_use, when the first has none', () => {
    resetTextBoundary({ runId: ctx.runId });
    parse(
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'final report.' }] },
      }),
    );
    const events = parse(
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Now let me read the file.' }] },
      }),
    );
    expect(events).toEqual([
      { kind: 'assistant_text', runId: ctx.runId, delta: '\n\nNow let me read the file.', at },
    ]);
  });

  it('emits usage + done for result success', () => {
    const events = parse(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'usage', usage: { inputTokens: 10, outputTokens: 5 } });
    expect(events[1]).toMatchObject({ kind: 'done' });
  });

  it('emits unknown_payload for unrecognised payload types', () => {
    const raw = { type: 'cursor_internal', seq: 7 };
    const events = parse(JSON.stringify(raw));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'unknown_payload',
      runId: ctx.runId,
      adapter: 'cursor',
      payloadType: 'cursor_internal',
      raw,
      at,
    });
  });

  it('calls onUnknown hook for unrecognised payload types', () => {
    const onUnknown = vi.fn();
    const raw = { type: 'unknown_event', x: 1 };
    parse(JSON.stringify(raw), { onUnknown });
    expect(onUnknown).toHaveBeenCalledWith('unknown_event', raw);
  });

  it('does not call onUnknown for known types', () => {
    const onUnknown = vi.fn();
    parse(JSON.stringify({ type: 'system', subtype: 'init' }), { onUnknown });
    parse(JSON.stringify({ type: 'assistant', message: { content: [] } }), { onUnknown });
    expect(onUnknown).not.toHaveBeenCalled();
  });
});
