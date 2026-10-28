import { describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { parseJsonLine, resetCopilotParseState, type ParseContext } from './parser';

const RUN_ID = brandId<ProviderRunId>({ value: 'run_copilot' });
const AT = brandId<IsoDateTime>({ value: '2026-10-28T00:00:00.000Z' });
const CTX: ParseContext = { runId: RUN_ID, now: () => AT };

type Params = {
  readonly payload: unknown;
  readonly ctx?: ParseContext;
};

const parse = ({ payload, ctx = CTX }: Params) =>
  parseJsonLine({ line: JSON.stringify(payload), ctx });

type DeltaParams = {
  readonly messageId: string;
  readonly deltaContent: string;
};

const delta = ({ messageId, deltaContent }: DeltaParams) => ({
  type: 'assistant.message_delta',
  data: { messageId, deltaContent },
});

type TextParams = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const textOf = ({ events }: TextParams): string =>
  events.map((event) => (event.kind === 'assistant_text' ? event.delta : '')).join('');

const CHECKPOINT = {
  type: 'session.usage_checkpoint',
  data: {
    totalNanoAiu: 2938990000,
    totalPremiumRequests: 1,
    accountingSnapshot: {
      tokenDetails: {
        input: { tokenCount: 8 },
        cache_read: { tokenCount: 70839 },
        cache_write: { tokenCount: 7708 },
        output: { tokenCount: 302 },
      },
      modelMetrics: {
        'claude-sonnet-5.5': {
          usage: {
            inputTokens: 78555,
            outputTokens: 302,
            cacheReadTokens: 70839,
            cacheWriteTokens: 7708,
          },
        },
      },
      lastCallInputTokens: 26394,
      lastCallOutputTokens: 25,
    },
  },
};

describe('parseJsonLine, copilot 1.0.105', () => {
  it('streams a reply as partial deltas and drops the final message that repeats them', () => {
    resetCopilotParseState({ runId: RUN_ID });
    const first = parse({ payload: delta({ messageId: 'm1', deltaContent: 'Hi! What' }) });
    const second = parse({
      payload: delta({ messageId: 'm1', deltaContent: ' would you like to work on?' }),
    });
    const final = parse({
      payload: {
        type: 'assistant.message',
        data: {
          messageId: 'm1',
          content: 'Hi! What would you like to work on?',
          toolRequests: [],
        },
      },
    });
    expect(first).toEqual([
      { kind: 'assistant_text', runId: RUN_ID, delta: 'Hi! What', at: AT, isPartial: true },
    ]);
    expect(second).toEqual([
      {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: ' would you like to work on?',
        at: AT,
        isPartial: true,
      },
    ]);
    expect(final).toEqual([]);
  });

  it('keeps a message that arrived without deltas', () => {
    resetCopilotParseState({ runId: RUN_ID });
    const events = parse({
      payload: {
        type: 'assistant.message',
        data: { messageId: 'm9', content: 'Northwind is ready.', toolRequests: [] },
      },
    });
    expect(events).toEqual([
      { kind: 'assistant_text', runId: RUN_ID, delta: 'Northwind is ready.', at: AT },
    ]);
  });

  it('puts a blank line between two messages of one turn', () => {
    resetCopilotParseState({ runId: RUN_ID });
    const first = parse({ payload: delta({ messageId: 'm1', deltaContent: 'Reading the file.' }) });
    parse({ payload: { type: 'assistant.message', data: { messageId: 'm1', content: 'x' } } });
    const second = parse({ payload: delta({ messageId: 'm2', deltaContent: 'Done.' }) });
    expect(textOf({ events: first })).toBe('Reading the file.');
    expect(textOf({ events: second })).toBe('\n\nDone.');
  });

  it('does not repeat the blank line inside one message', () => {
    resetCopilotParseState({ runId: RUN_ID });
    parse({ payload: delta({ messageId: 'm1', deltaContent: 'One' }) });
    const next = parse({ payload: delta({ messageId: 'm1', deltaContent: ' two' }) });
    expect(textOf({ events: next })).toBe(' two');
  });

  it('maps a tool call to a start and an end', () => {
    const start = parse({
      payload: {
        type: 'tool.execution_start',
        data: {
          toolCallId: 'call_1',
          toolName: 'view',
          arguments: { path: '/tmp/harborline/notes.txt' },
        },
      },
    });
    const end = parse({
      payload: {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'call_1',
          success: true,
          result: { content: 'harborline\n', detailedContent: 'diff' },
        },
      },
    });
    expect(start).toEqual([
      {
        kind: 'tool_call_start',
        runId: RUN_ID,
        toolUseId: 'call_1',
        toolName: 'view',
        input: { path: '/tmp/harborline/notes.txt' },
        at: AT,
      },
    ]);
    expect(end).toEqual([
      {
        kind: 'tool_call_end',
        runId: RUN_ID,
        toolUseId: 'call_1',
        output: 'harborline\n',
        isError: false,
        at: AT,
      },
    ]);
  });

  it('reports a failed tool and a file the tool wrote', () => {
    const failed = parse({
      payload: {
        type: 'tool.execution_complete',
        data: { toolCallId: 'call_2', success: false, result: { content: 'denied' } },
      },
    });
    const created = parse({
      payload: {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'call_3',
          success: true,
          fileEdits: [{ path: '/tmp/harborline/out.txt', kind: 'create' }],
          result: { content: 'Created file' },
        },
      },
    });
    expect(failed).toEqual([
      {
        kind: 'tool_call_end',
        runId: RUN_ID,
        toolUseId: 'call_2',
        output: 'denied',
        isError: true,
        at: AT,
      },
    ]);
    expect(created[0]).toEqual({
      kind: 'file_edit',
      runId: RUN_ID,
      path: '/tmp/harborline/out.txt',
      editType: 'create',
      at: AT,
    });
    expect(created[1]?.kind).toBe('tool_call_end');
  });

  it('ignores a tool event that names no call', () => {
    expect(parse({ payload: { type: 'tool.execution_start', data: {} } })).toEqual([]);
    expect(parse({ payload: { type: 'tool.execution_complete', data: {} } })).toEqual([]);
  });

  it('emits the session id and one usage with the premium requests at the result', () => {
    resetCopilotParseState({ runId: RUN_ID });
    expect(parse({ payload: CHECKPOINT })).toEqual([]);
    const events = parse({
      payload: {
        type: 'result',
        sessionId: 'session-ledger-core-1',
        exitCode: 0,
        usage: { premiumRequests: 1 },
      },
    });
    expect(events).toEqual([
      {
        kind: 'provider_session_init',
        runId: RUN_ID,
        providerSessionId: 'session-ledger-core-1',
        at: AT,
      },
      {
        kind: 'usage',
        runId: RUN_ID,
        usage: {
          inputTokens: 8,
          outputTokens: 302,
          cachedInputTokens: 70839,
          cacheCreationInputTokens: 7708,
          contextTokens: 26419,
          premiumRequests: 1,
          nanoAiu: 2938990000,
          estimatedCostUsd: 0,
        },
        at: AT,
      },
    ]);
  });

  it('keeps the dollar cost at zero and never invents a price', () => {
    resetCopilotParseState({ runId: RUN_ID });
    parse({ payload: CHECKPOINT });
    const usage = parse({ payload: { type: 'result', sessionId: 's' } }).find(
      (event) => event.kind === 'usage',
    );
    expect(usage?.kind === 'usage' ? usage.usage.estimatedCostUsd : null).toBe(0);
  });

  it('falls back to the per model counters when the token breakdown is missing', () => {
    resetCopilotParseState({ runId: RUN_ID });
    parse({
      payload: {
        type: 'session.usage_checkpoint',
        data: {
          totalPremiumRequests: 2,
          accountingSnapshot: {
            modelMetrics: {
              'claude-sonnet-5.5': {
                usage: {
                  inputTokens: 1000,
                  outputTokens: 40,
                  cacheReadTokens: 700,
                  cacheWriteTokens: 200,
                },
              },
            },
          },
        },
      },
    });
    const events = parse({ payload: { type: 'result', exitCode: 0 } });
    expect(events).toEqual([
      {
        kind: 'usage',
        runId: RUN_ID,
        usage: {
          inputTokens: 100,
          outputTokens: 40,
          cachedInputTokens: 700,
          cacheCreationInputTokens: 200,
          premiumRequests: 2,
          estimatedCostUsd: 0,
        },
        at: AT,
      },
    ]);
  });

  it('emits no usage when the turn never reported one', () => {
    resetCopilotParseState({ runId: RUN_ID });
    expect(parse({ payload: { type: 'result', sessionId: 's', exitCode: 1 } })).toEqual([
      { kind: 'provider_session_init', runId: RUN_ID, providerSessionId: 's', at: AT },
    ]);
  });

  it('forgets the run at the result so a second turn starts clean', () => {
    resetCopilotParseState({ runId: RUN_ID });
    parse({ payload: delta({ messageId: 'm1', deltaContent: 'First' }) });
    parse({ payload: CHECKPOINT });
    parse({ payload: { type: 'result', sessionId: 's' } });
    const next = parse({ payload: delta({ messageId: 'm1', deltaContent: 'Again' }) });
    expect(textOf({ events: next })).toBe('Again');
    expect(parse({ payload: { type: 'result' } })).toEqual([]);
  });

  it('skips the housekeeping events without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const type of [
      'session.mcp_server_status_changed',
      'session.tools_updated',
      'user.message',
      'assistant.turn_start',
      'assistant.message_start',
      'assistant.tool_call_delta',
      'model.call_start',
      'model.call_finished',
      'assistant.turn_end',
      'assistant.idle',
    ]) {
      expect(parse({ payload: { type, data: {} } }), type).toEqual([]);
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops an unmapped event the CLI marks ephemeral, without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const events = parse({
      payload: { type: 'session.synthetic_progress', data: { step: 1 }, ephemeral: true },
    });
    expect(events).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps an event it does not know as an unknown payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onUnknown = vi.fn();
    const events = parse({
      payload: { type: 'session.compaction_start', data: { reason: 'size' } },
      ctx: { ...CTX, onUnknown },
    });
    expect(events).toEqual([
      {
        kind: 'unknown_payload',
        runId: RUN_ID,
        adapter: 'copilot',
        payloadType: 'session.compaction_start',
        raw: { type: 'session.compaction_start', data: { reason: 'size' } },
        at: AT,
      },
    ]);
    expect(onUnknown).toHaveBeenCalledWith('session.compaction_start', expect.anything());
    warn.mockRestore();
  });

  it('drops a line that is not json and a blank line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseJsonLine({ line: 'Error: not signed in', ctx: CTX })).toEqual([]);
    expect(parseJsonLine({ line: '   ', ctx: CTX })).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[copilot-adapter] dropped a json line that does not parse');
    warn.mockRestore();
  });
});
