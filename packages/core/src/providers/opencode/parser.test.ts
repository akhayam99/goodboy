import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { parseJsonLine, resetOpenCodeParseState, type ParseContext } from './parser';

const RUN_ID = 'run_opencode' as ProviderRunId;
const AT = '2026-07-27T00:00:00.000Z' as IsoDateTime;
const CTX: ParseContext = {
  runId: RUN_ID,
  now: () => AT,
};

type Params = {
  readonly payload: unknown;
  readonly ctx?: ParseContext;
};

const parse = ({ payload, ctx = CTX }: Params) => {
  return parseJsonLine({ line: JSON.stringify(payload), ctx });
};

describe('parseJsonLine, opencode 1.14.48', () => {
  it('captures the session id once and ignores malformed input', () => {
    resetOpenCodeParseState({ runId: RUN_ID });
    const first = parse({
      payload: {
        type: 'step_start',
        sessionID: 'ses_1',
        part: { id: 'part_1', type: 'step-start' },
      },
    });
    const second = parse({
      payload: {
        type: 'text',
        sessionID: 'ses_1',
        part: { id: 'part_2', type: 'text', text: '' },
      },
    });
    expect(first).toEqual([
      {
        kind: 'provider_session_init',
        runId: RUN_ID,
        providerSessionId: 'ses_1',
        at: AT,
      },
    ]);
    expect(second).toEqual([]);
    expect(parseJsonLine({ line: 'not json', ctx: CTX })).toEqual([]);
  });

  it('converts cumulative text replacements into deltas by part id', () => {
    resetOpenCodeParseState({ runId: RUN_ID });
    const first = parse({
      payload: { type: 'text', part: { id: 'part_text', type: 'text', text: 'Hello' } },
    });
    const second = parse({
      payload: {
        type: 'text',
        part: { id: 'part_text', type: 'text', text: 'Hello world' },
      },
    });
    expect(first).toEqual([{ kind: 'assistant_text', runId: RUN_ID, delta: 'Hello', at: AT }]);
    expect(second).toEqual([{ kind: 'assistant_text', runId: RUN_ID, delta: ' world', at: AT }]);
  });

  it('maps tool lifecycle and usage events', () => {
    resetOpenCodeParseState({ runId: RUN_ID });
    const start = parse({
      payload: {
        type: 'tool',
        part: {
          id: 'tool_1',
          type: 'tool',
          tool: 'bash',
          state: { status: 'running', input: { command: 'ls' } },
        },
      },
    });
    const end = parse({
      payload: {
        type: 'tool',
        part: {
          id: 'tool_1',
          type: 'tool',
          tool: 'bash',
          state: { status: 'completed', output: 'file.ts' },
        },
      },
    });
    const usage = parse({
      payload: {
        type: 'step_finish',
        part: {
          type: 'step-finish',
          tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
          cost: 0.0123,
        },
      },
    });
    expect(start[0]).toMatchObject({ kind: 'tool_call_start', toolUseId: 'tool_1' });
    expect(end[0]).toMatchObject({ kind: 'tool_call_end', output: 'file.ts', isError: false });
    expect(usage[0]).toMatchObject({
      kind: 'usage',
      usage: {
        inputTokens: 100,
        outputTokens: 60,
        cachedInputTokens: 25,
        estimatedCostUsd: 0.0123,
      },
    });
  });

  it('maps nested API errors and emits unknown payloads defensively', () => {
    resetOpenCodeParseState({ runId: RUN_ID });
    const onUnknown = vi.fn();
    const error = parse({
      payload: {
        type: 'error',
        error: { name: 'APIError', data: { message: 'Model unavailable' } },
      },
    });
    const unknown = parse({
      payload: { type: 'snapshot_ready', snapshot: 'snap_1' },
      ctx: { ...CTX, onUnknown },
    });
    expect(error[0]).toMatchObject({ kind: 'error', message: 'Model unavailable' });
    expect(unknown[0]).toMatchObject({
      kind: 'unknown_payload',
      adapter: 'opencode',
      payloadType: 'snapshot_ready',
    });
    expect(onUnknown).toHaveBeenCalledOnce();
  });
});
