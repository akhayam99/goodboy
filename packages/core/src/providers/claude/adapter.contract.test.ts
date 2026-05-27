import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId, TurnEvent, TurnRequest } from '@goodboy/types';
import { ClaudeAdapter } from './adapter';

const fakeNow = (): IsoDateTime => '2026-05-07T00:00:00.000Z' as IsoDateTime;

class StreamChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  exitCode: number | null = null;
  killed = false;
  signal: NodeJS.Signals | null = null;

  constructor(lines: ReadonlyArray<string>, exit = 0) {
    super();
    this.stdout = Readable.from(lines.map((line) => `${line}\n`));
    this.stderr = Readable.from([]);
    queueMicrotask(() => {
      this.exitCode = exit;
      this.stdout.on('end', () => this.emit('close', exit));
    });
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true;
    this.signal = signal;
    this.exitCode = 143;
    return true;
  }
}

function makeRequest(): TurnRequest {
  return {
    runId: 'run_contract' as ProviderRunId,
    sessionId: 'sess_contract' as SessionId,
    model: 'claude-opus-4-7',
    workingDir: '/tmp/contract',
    systemPrompt: 'sys',
    userMessage: 'hi',
  };
}

async function collect(adapter: ClaudeAdapter): Promise<ReadonlyArray<TurnEvent>> {
  const events: TurnEvent[] = [];
  for await (const event of adapter.spawn(makeRequest())) {
    events.push(event);
  }
  return events;
}

const FIXTURES = {
  init: JSON.stringify({ type: 'system', subtype: 'init' }),
  assistantText: JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'hello world' }] },
  }),
  toolUseBash: JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id: 'tool_a', name: 'Bash', input: { command: 'ls' } }],
    },
  }),
  toolUseWrite: JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'tool_b',
          name: 'Write',
          input: { file_path: '/tmp/x.ts', content: 'export {};' },
        },
      ],
    },
  }),
  toolUseEdit: JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'tool_c',
          name: 'Edit',
          input: { file_path: '/tmp/y.ts', old_string: 'a', new_string: 'b' },
        },
      ],
    },
  }),
  toolResult: JSON.stringify({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool_a',
          content: 'file1\nfile2',
          is_error: false,
        },
      ],
    },
  }),
  resultSuccess: JSON.stringify({
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 3 },
  }),
  resultError: JSON.stringify({ type: 'result', subtype: 'error', error: 'rate limit' }),
};

describe('ClaudeAdapter, stream-json contract', () => {
  it('normalizes a full conversational turn into the expected event sequence', async () => {
    const lines = [
      FIXTURES.init,
      FIXTURES.assistantText,
      FIXTURES.toolUseBash,
      FIXTURES.toolResult,
      FIXTURES.assistantText,
      FIXTURES.resultSuccess,
    ];
    const child = new StreamChild(lines);
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
    });

    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual([
      'assistant_text',
      'tool_call_start',
      'tool_call_end',
      'assistant_text',
      'usage',
      'done',
    ]);
  });

  it('emits a file_edit alongside tool_call_start for Write', async () => {
    const child = new StreamChild([FIXTURES.toolUseWrite, FIXTURES.resultSuccess]);
    const adapter = new ClaudeAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/x.ts', editType: 'create' });
  });

  it('marks Edit as modify, not create', async () => {
    const child = new StreamChild([FIXTURES.toolUseEdit, FIXTURES.resultSuccess]);
    const adapter = new ClaudeAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/y.ts', editType: 'modify' });
  });

  it('emits an error event when the result subtype is error', async () => {
    const child = new StreamChild([FIXTURES.assistantText, FIXTURES.resultError]);
    const adapter = new ClaudeAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const error = events.find((e) => e.kind === 'error');
    expect(error).toMatchObject({ message: 'rate limit' });
  });

  it('tolerates malformed json lines without crashing the stream', async () => {
    const lines = ['this is not json', '{ broken', FIXTURES.assistantText, FIXTURES.resultSuccess];
    const child = new StreamChild(lines);
    const adapter = new ClaudeAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual(['assistant_text', 'usage', 'done']);
  });

  it('emits unknown_payload event and invokes onUnknown for unrecognized payload types', async () => {
    const onUnknown = vi.fn();
    const lines = [
      FIXTURES.assistantText,
      JSON.stringify({ type: 'mystery_event', payload: { x: 1 } }),
      FIXTURES.resultSuccess,
    ];
    const child = new StreamChild(lines);
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
      onUnknown,
    });
    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual([
      'assistant_text',
      'unknown_payload',
      'usage',
      'done',
    ]);
    expect(events[1]).toMatchObject({
      kind: 'unknown_payload',
      adapter: 'anthropic',
      payloadType: 'mystery_event',
    });
    expect(onUnknown).toHaveBeenCalledWith(
      'mystery_event',
      expect.objectContaining({ type: 'mystery_event' }),
    );
  });

  it('does not call onUnknown for known types', async () => {
    const onUnknown = vi.fn();
    const child = new StreamChild([
      FIXTURES.init,
      FIXTURES.assistantText,
      FIXTURES.toolUseBash,
      FIXTURES.toolResult,
      FIXTURES.resultSuccess,
    ]);
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
      onUnknown,
    });
    await collect(adapter);
    expect(onUnknown).not.toHaveBeenCalled();
  });

  it('preserves usage token fields verbatim in the normalized event', async () => {
    const child = new StreamChild([FIXTURES.resultSuccess]);
    const adapter = new ClaudeAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const usage = events.find((e) => e.kind === 'usage');
    expect(usage).toMatchObject({
      kind: 'usage',
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        cachedInputTokens: 3,
      },
    });
  });
});
