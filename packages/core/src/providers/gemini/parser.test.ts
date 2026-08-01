import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { parseJsonLine, type ParseContext } from './parser';

const at = '2026-05-28T00:00:00.000Z' as IsoDateTime;
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
};

type ParseParams = {
  readonly line: string;
  readonly overrides?: Partial<ParseContext>;
};

const parse = ({ line, overrides = {} }: ParseParams) => {
  return parseJsonLine(line, { ...ctx, ...overrides });
};

describe('parseJsonLine (gemini stream-json)', () => {
  it('returns no events for blank lines', () => {
    expect(parse({ line: '' })).toEqual([]);
    expect(parse({ line: '   ' })).toEqual([]);
  });

  it('keeps plain prose readable as assistant text', () => {
    expect(parse({ line: 'Hello, world!' })).toEqual([
      {
        kind: 'assistant_text',
        runId: ctx.runId,
        delta: 'Hello, world!\n',
        at,
      },
    ]);
  });

  it('initializes the Gemini provider session from the conversation id', () => {
    const events = parse({
      line: JSON.stringify({
        event: 'init',
        conversation_id: 'fe3759b4',
        init: {
          model: 'gemini-3.5-flash',
          cwd: '/tmp/x',
          tools: ['view_file', 'run_command'],
          permission_mode: 'request-review',
        },
      }),
    });
    expect(events).toEqual([
      {
        kind: 'provider_session_init',
        runId: ctx.runId,
        providerSessionId: 'fe3759b4',
        provider: 'gemini',
        at,
      },
    ]);
  });

  it('concatenates agent response deltas in stream order', () => {
    const lines = [
      {
        event: 'step_update',
        step_update: {
          conversation_id: 'fe3759b4',
          step_index: 2,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: 'line one\nline two',
        },
      },
      {
        event: 'step_update',
        step_update: {
          conversation_id: 'fe3759b4',
          step_index: 2,
          state: 'DONE',
          step_type: 'agent_response',
          text_delta: '\n',
          usage: {
            input_tokens: 17648,
            output_tokens: 21,
            thinking_tokens: 20,
            cache_read_tokens: 0,
            total_tokens: 17669,
          },
        },
      },
    ];
    const events = lines.flatMap((line) => parse({ line: JSON.stringify(line) }));
    expect(events).toEqual([
      { kind: 'assistant_text', runId: ctx.runId, delta: 'line one\nline two', at },
      { kind: 'assistant_text', runId: ctx.runId, delta: '\n', at },
    ]);
    expect(events.map((event) => ('delta' in event ? event.delta : '')).join('')).toBe(
      'line one\nline two\n',
    );
  });

  it('ignores checkpoint lifecycle updates including their usage', () => {
    const events = parse({
      line: JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'fe3759b4',
          step_index: 3,
          state: 'DONE',
          step_type: 'checkpoint',
          usage: {
            input_tokens: 103,
            output_tokens: 5,
            thinking_tokens: 0,
            cache_read_tokens: 0,
            total_tokens: 108,
          },
        },
      }),
    });
    expect(events).toEqual([]);
  });

  it('emits exactly one usage event from the final turn totals', () => {
    const events = parse({
      line: JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'fe3759b4',
          status: 'SUCCESS',
          response: 'line one\nline two\n',
          duration_seconds: 1.8,
          num_turns: 1,
          usage: {
            input_tokens: 17751,
            output_tokens: 26,
            thinking_tokens: 20,
            cache_read_tokens: 7,
            total_tokens: 17777,
          },
        },
      }),
    });
    expect(events).toEqual([
      {
        kind: 'usage',
        runId: ctx.runId,
        usage: {
          inputTokens: 17751,
          outputTokens: 26,
          cachedInputTokens: 7,
          cacheCreationInputTokens: 0,
          contextTokens: 17777,
          estimatedCostUsd: 0,
        },
        at,
      },
    ]);
  });

  it('emits usage and an error when the final result failed', () => {
    const events = parse({
      line: JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'fe3759b4',
          status: 'FAILED',
          error: { message: 'quota exceeded' },
          usage: {
            input_tokens: 3,
            output_tokens: 2,
            cache_read_tokens: 1,
          },
        },
      }),
    });
    expect(events).toEqual([
      {
        kind: 'usage',
        runId: ctx.runId,
        usage: {
          inputTokens: 3,
          outputTokens: 2,
          cachedInputTokens: 1,
          cacheCreationInputTokens: 0,
          contextTokens: 5,
          estimatedCostUsd: 0,
        },
        at,
      },
      {
        kind: 'error',
        runId: ctx.runId,
        message: 'FAILED: quota exceeded',
        at,
      },
    ]);
  });

  it('reports unrecognized events through the unknown payload callback', () => {
    const onUnknown = vi.fn();
    const payload = { event: 'future_event', value: 42 };
    const events = parse({ line: JSON.stringify(payload), overrides: { onUnknown } });
    expect(onUnknown).toHaveBeenCalledWith('future_event', payload);
    expect(events).toEqual([
      {
        kind: 'unknown_payload',
        runId: ctx.runId,
        adapter: 'gemini',
        payloadType: 'future_event',
        raw: payload,
        at,
      },
    ]);
  });
});
