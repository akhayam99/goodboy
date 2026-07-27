import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { parseJsonLine, type ParseContext } from './parser';
import { resetTextBoundary } from '../shared/text-boundary';

const at = '2026-05-13T00:00:00.000Z' as IsoDateTime;
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
};

function parse(line: string, overrides?: Partial<ParseContext>) {
  return parseJsonLine(line, { ...ctx, ...overrides });
}

describe('parseJsonLine (codex v0.130.0)', () => {
  it('returns [] for empty / blank lines', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   ')).toEqual([]);
  });

  it('returns [] for malformed json', () => {
    expect(parse('{not json')).toEqual([]);
    expect(parse('not json at all')).toEqual([]);
  });

  it('emits provider_session_init from thread.started', () => {
    const events = parse(JSON.stringify({ type: 'thread.started', thread_id: 'abc-123' }));
    expect(events).toEqual([
      {
        kind: 'provider_session_init',
        runId: ctx.runId,
        providerSessionId: 'abc-123',
        at,
      },
    ]);
  });

  it('ignores turn.started silently', () => {
    expect(parse(JSON.stringify({ type: 'turn.started' }))).toEqual([]);
  });

  it('emits tool_call_start for item.started of command_execution', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.started',
        item: {
          id: 'item_0',
          type: 'command_execution',
          command: '/bin/zsh -lc ls',
          status: 'in_progress',
        },
      }),
    );
    expect(events).toEqual([
      {
        kind: 'tool_call_start',
        runId: ctx.runId,
        toolUseId: 'item_0',
        toolName: 'shell',
        input: { command: '/bin/zsh -lc ls' },
        at,
      },
    ]);
  });

  it('emits tool_call_end for item.completed of command_execution', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_0',
          type: 'command_execution',
          command: '/bin/zsh -lc ls',
          aggregated_output: 'file1\n',
          exit_code: 0,
          status: 'completed',
        },
      }),
    );
    expect(events).toEqual([
      {
        kind: 'tool_call_end',
        runId: ctx.runId,
        toolUseId: 'item_0',
        output: { aggregated_output: 'file1\n', exit_code: 0 },
        isError: false,
        at,
      },
    ]);
  });

  it('marks tool_call_end isError true when exit_code != 0', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_e',
          type: 'command_execution',
          aggregated_output: 'denied',
          exit_code: 126,
          status: 'completed',
        },
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'tool_call_end', isError: true });
  });

  it('emits assistant_text for item.completed of agent_message', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: 'hello' },
      }),
    );
    expect(events).toEqual([{ kind: 'assistant_text', runId: ctx.runId, delta: 'hello', at }]);
  });

  it('inserts a blank line between two agent_message items in the same turn', () => {
    resetTextBoundary({ runId: ctx.runId });
    parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: 'final report.' },
      }),
    );
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_2', type: 'agent_message', text: 'Now let me read the file.' },
      }),
    );
    expect(events).toEqual([
      { kind: 'assistant_text', runId: ctx.runId, delta: '\n\nNow let me read the file.', at },
    ]);
  });

  it('resets the boundary state after turn.completed so the next turn starts fresh', () => {
    resetTextBoundary({ runId: ctx.runId });
    parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: 'done.' },
      }),
    );
    parse(JSON.stringify({ type: 'turn.completed', usage: {} }));
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_2', type: 'agent_message', text: 'new turn text' },
      }),
    );
    expect(events).toEqual([
      { kind: 'assistant_text', runId: ctx.runId, delta: 'new turn text', at },
    ]);
  });

  it('skips agent_message with empty text', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: '' },
      }),
    );
    expect(events).toEqual([]);
  });

  it('emits file_edit + tool_call_end for apply_patch items', () => {
    const events = parse(
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_p',
          type: 'apply_patch',
          changes: [
            { path: '/tmp/new.ts', kind: 'create' },
            { path: '/tmp/old.ts', kind: 'modify' },
          ],
        },
      }),
    );
    const fileEdits = events.filter((e) => e.kind === 'file_edit');
    expect(fileEdits).toHaveLength(2);
    expect(fileEdits[0]).toMatchObject({ path: '/tmp/new.ts', editType: 'create' });
    expect(fileEdits[1]).toMatchObject({ path: '/tmp/old.ts', editType: 'modify' });
  });

  it('emits usage from turn.completed.usage with reasoning_output_tokens folded into output', () => {
    const events = parse(
      JSON.stringify({
        type: 'turn.completed',
        usage: {
          input_tokens: 100,
          cached_input_tokens: 30,
          output_tokens: 50,
          reasoning_output_tokens: 20,
        },
      }),
    );
    expect(events).toEqual([
      {
        kind: 'usage',
        runId: ctx.runId,
        usage: {
          inputTokens: 100,
          outputTokens: 70,
          cachedInputTokens: 30,
          estimatedCostUsd: 0,
        },
        at,
      },
    ]);
  });

  it('emits error event for error type', () => {
    const events = parse(JSON.stringify({ type: 'error', message: 'rate limit exceeded' }));
    expect(events[0]).toMatchObject({ kind: 'error', message: 'rate limit exceeded' });
  });

  it('emits unknown_payload for unrecognized types', () => {
    const onUnknown = vi.fn();
    const raw = { type: 'mystery_event', payload: { x: 1 } };
    const events = parse(JSON.stringify(raw), { onUnknown });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'unknown_payload',
      runId: ctx.runId,
      adapter: 'codex',
      payloadType: 'mystery_event',
      raw,
      at,
    });
    expect(onUnknown).toHaveBeenCalled();
  });

  it('does not call onUnknown for known types', () => {
    const onUnknown = vi.fn();
    parse(JSON.stringify({ type: 'turn.started' }), { onUnknown });
    parse(JSON.stringify({ type: 'turn.completed', usage: {} }), { onUnknown });
    parse(JSON.stringify({ type: 'thread.started', thread_id: 'x' }), { onUnknown });
    expect(onUnknown).not.toHaveBeenCalled();
  });
});
