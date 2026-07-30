import { describe, expect, it } from 'vitest';
import { extractAuxOutput } from './aux-output';

describe('extractAuxOutput, anthropic envelope', () => {
  it('reads result text and usage', () => {
    const stdout = JSON.stringify({
      result: '{"upserts":[]}',
      subtype: 'success',
      is_error: false,
      usage: {
        input_tokens: 10,
        output_tokens: 4,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 3,
      },
    });

    expect(extractAuxOutput({ providerId: 'anthropic', stdout })).toEqual({
      text: '{"upserts":[]}',
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        cachedInputTokens: 2,
        cacheCreationInputTokens: 3,
      },
      isError: false,
      errorMessage: null,
      envelopeDecoded: true,
    });
  });

  it('flags an error payload that exits zero', () => {
    const stdout = JSON.stringify({
      result: 'partial',
      subtype: 'error_during_execution',
      is_error: true,
    });
    const out = extractAuxOutput({ providerId: 'anthropic', stdout });

    expect(out.isError).toBe(true);
    expect(out.errorMessage).toBe('error_during_execution');
  });

  it('marks non-json stdout as undecoded and keeps it as text', () => {
    const out = extractAuxOutput({ providerId: 'anthropic', stdout: 'not json at all' });

    expect(out.envelopeDecoded).toBe(false);
    expect(out.text).toBe('not json at all');
  });
});

describe('extractAuxOutput, cursor stream-json', () => {
  it('unwraps the result line instead of returning the raw event stream', () => {
    const stdout = [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'ignored draft' }] },
      }),
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'fix-auth-token-refresh',
        usage: { input_tokens: 7, output_tokens: 3 },
      }),
    ].join('\n');
    const out = extractAuxOutput({ providerId: 'cursor', stdout });

    expect(out.text).toBe('fix-auth-token-refresh');
    expect(out.usage.inputTokens).toBe(7);
    expect(out.envelopeDecoded).toBe(true);
  });

  it('falls back to assistant text blocks when no result line arrives', () => {
    const stdout = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'branch-slug-here' }] },
    });

    expect(extractAuxOutput({ providerId: 'cursor', stdout }).text).toBe('branch-slug-here');
  });

  it('passes plain stdout through untouched', () => {
    const out = extractAuxOutput({ providerId: 'cursor', stdout: 'Implemented auth flow.' });

    expect(out.text).toBe('Implemented auth flow.');
    expect(out.envelopeDecoded).toBe(true);
  });

  it('passes a bare JSON answer through when no stream events are present', () => {
    const stdout = '{"upserts":[{"key":"goal","value":"ship it"}]}';

    expect(extractAuxOutput({ providerId: 'cursor', stdout }).text).toBe(stdout);
  });
});

describe('extractAuxOutput, codex json stream', () => {
  it('takes the last agent message and the turn usage', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'i1', type: 'command_execution', command: 'ls' },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'i2', type: 'agent_message', text: 'refactor-slot-parser' },
      }),
      JSON.stringify({
        type: 'turn.completed',
        usage: { input_tokens: 5, output_tokens: 2, reasoning_output_tokens: 3 },
      }),
    ].join('\n');
    const out = extractAuxOutput({ providerId: 'codex', stdout });

    expect(out.text).toBe('refactor-slot-parser');
    expect(out.usage.outputTokens).toBe(5);
  });

  it('reports a stream error event', () => {
    const stdout = JSON.stringify({ type: 'error', message: 'model unavailable' });
    const out = extractAuxOutput({ providerId: 'codex', stdout });

    expect(out.isError).toBe(true);
    expect(out.errorMessage).toBe('model unavailable');
  });
});

describe('extractAuxOutput, gemini', () => {
  it('treats stdout as the answer', () => {
    const out = extractAuxOutput({ providerId: 'gemini', stdout: '  add-session-filters \n' });

    expect(out.text).toBe('add-session-filters');
    expect(out.envelopeDecoded).toBe(true);
  });
});

describe('extractAuxOutput, opencode json stream', () => {
  it('uses cumulative text parts and token usage', () => {
    const stdout = [
      JSON.stringify({
        type: 'text',
        part: { id: 'part_1', type: 'text', text: 'branch' },
      }),
      JSON.stringify({
        type: 'text',
        part: { id: 'part_1', type: 'text', text: 'branch-name' },
      }),
      JSON.stringify({
        type: 'step_finish',
        part: {
          type: 'step-finish',
          tokens: { input: 5, output: 2, reasoning: 3, cache: { read: 1, write: 1 } },
        },
      }),
    ].join('\n');
    const out = extractAuxOutput({ providerId: 'opencode', stdout });
    expect(out.text).toBe('branch-name');
    expect(out.usage).toEqual({
      inputTokens: 5,
      outputTokens: 5,
      cachedInputTokens: 1,
      cacheCreationInputTokens: 1,
    });
  });

  it('decodes nested errors for openrouter', () => {
    const stdout = JSON.stringify({
      type: 'error',
      error: { name: 'APIError', data: { message: 'Invalid key' } },
    });
    const out = extractAuxOutput({ providerId: 'openrouter', stdout });
    expect(out.isError).toBe(true);
    expect(out.errorMessage).toBe('Invalid key');
  });
});
