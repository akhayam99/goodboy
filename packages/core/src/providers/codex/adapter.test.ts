import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId, TurnEvent, TurnRequest } from '@goodboy/types';
import { CodexAdapter } from './adapter';
import { CODEX_DEFAULT_MODEL } from './constants';

const fakeNow = (): IsoDateTime => '2026-05-13T00:00:00.000Z' as IsoDateTime;

class FakeChild extends EventEmitter {
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

class OpenChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  exitCode: number | null = null;
  killed = false;
  signal: NodeJS.Signals | null = null;

  constructor(lines: ReadonlyArray<string>) {
    super();
    this.stdout = new Readable({ read() {} });
    for (const line of lines) this.stdout.push(`${line}\n`);
    this.stderr = new Readable({ read() {} });
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
    runId: 'run_codex' as ProviderRunId,
    sessionId: 'sess_1' as SessionId,
    model: CODEX_DEFAULT_MODEL,
    workingDir: '/tmp/demo',
    systemPrompt: 'sys',
    userMessage: 'hi',
  };
}

const FIXTURES = {
  threadStart: JSON.stringify({ type: 'thread.started', thread_id: 'thr_1' }),
  turnStart: JSON.stringify({ type: 'turn.started' }),
  assistantMessage: JSON.stringify({
    type: 'item.completed',
    item: { id: 'item_msg', type: 'agent_message', text: 'hello world' },
  }),
  cmdStart: JSON.stringify({
    type: 'item.started',
    item: { id: 'item_cmd', type: 'command_execution', command: 'ls', status: 'in_progress' },
  }),
  cmdEnd: JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'item_cmd',
      type: 'command_execution',
      command: 'ls',
      aggregated_output: 'file1\n',
      exit_code: 0,
      status: 'completed',
    },
  }),
  turnComplete: JSON.stringify({
    type: 'turn.completed',
    usage: { input_tokens: 100, cached_input_tokens: 30, output_tokens: 50 },
  }),
  errorEvent: JSON.stringify({ type: 'error', message: 'quota exceeded' }),
};

async function collect(adapter: CodexAdapter, request?: TurnRequest): Promise<TurnEvent[]> {
  const events: TurnEvent[] = [];
  for await (const event of adapter.spawn(request ?? makeRequest())) {
    events.push(event);
  }
  return events;
}

describe('CodexAdapter.spawn', () => {
  it('emits parsed TurnEvents for a full turn', async () => {
    const lines = [
      FIXTURES.threadStart,
      FIXTURES.turnStart,
      FIXTURES.cmdStart,
      FIXTURES.cmdEnd,
      FIXTURES.assistantMessage,
      FIXTURES.turnComplete,
    ];
    const child = new FakeChild(lines);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });

    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual([
      'provider_session_init',
      'tool_call_start',
      'tool_call_end',
      'assistant_text',
      'usage',
      'done',
    ]);
  });

  it('emits assistant_text with correct delta from agent_message item', async () => {
    const child = new FakeChild([FIXTURES.assistantMessage]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const text = events.find((e) => e.kind === 'assistant_text');
    expect(text).toMatchObject({ delta: 'hello world' });
  });

  it('emits usage with real token counts from turn.completed', async () => {
    const child = new FakeChild([FIXTURES.turnComplete]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const usage = events.find((e) => e.kind === 'usage');
    expect(usage).toMatchObject({
      kind: 'usage',
      usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 30, estimatedCostUsd: 0 },
    });
  });

  it('always emits done as the last event', async () => {
    const child = new FakeChild([FIXTURES.assistantMessage]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events[events.length - 1]?.kind).toBe('done');
  });

  it('tolerates malformed JSON lines without crashing', async () => {
    const lines = ['not json', '{ broken', FIXTURES.assistantMessage];
    const child = new FakeChild(lines);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.some((e) => e.kind === 'assistant_text')).toBe(true);
  });

  it('emits error event when codex emits error type', async () => {
    const child = new FakeChild([FIXTURES.errorEvent]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const errorEvent = events.find((e) => e.kind === 'error');
    expect(errorEvent).toMatchObject({ kind: 'error', message: 'quota exceeded' });
  });

  it('throws when child process emits error', async () => {
    const child = new FakeChild([], 1);
    queueMicrotask(() => child.emit('error', new Error('ENOENT codex')));
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    await expect(collect(adapter)).rejects.toThrow('ENOENT codex');
  });

  it('kills the child on early break', async () => {
    const child = new OpenChild([FIXTURES.assistantMessage]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const iterator = adapter.spawn(makeRequest())[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    await iterator.return?.(undefined);
    expect(child.killed).toBe(true);
    expect(child.signal).toBe('SIGTERM');
  });

  it('emits file_edit alongside tool_call_end for apply_patch items', async () => {
    const writeCall = JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'item_p',
        type: 'apply_patch',
        changes: [{ path: '/tmp/out.ts', kind: 'create' }],
      },
    });
    const child = new FakeChild([writeCall]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const fileEdit = events.find((e) => e.kind === 'file_edit');
    expect(fileEdit).toMatchObject({ path: '/tmp/out.ts', editType: 'create' });
  });
});

describe('CodexAdapter.detect', () => {
  it('returns available with parsed version on exit 0', async () => {
    const child = new FakeChild(['1.0.0']);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const result = await adapter.detect();
    expect(result.kind).toBe('available');
  });

  it('returns missing on spawn error', async () => {
    const child = new FakeChild([]);
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const result = await adapter.detect();
    expect(result.kind).toBe('missing');
  });
});

describe('CodexAdapter.cost', () => {
  it('prices the catalog default without an injected override', () => {
    const adapter = new CodexAdapter();
    expect(
      adapter.cost(
        {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cachedInputTokens: 0,
          estimatedCostUsd: 0,
        },
        CODEX_DEFAULT_MODEL,
      ),
    ).toBeCloseTo(35);
  });
});
