import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TaskId, TurnEvent, TurnRequest } from '@kay-am/types';
import { CodexAdapter } from './adapter';

const fakeNow = (): IsoDateTime => '2026-05-07T00:00:00.000Z' as IsoDateTime;

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
    taskId: 'sess_1' as TaskId,
    model: 'codex-latest',
    workingDir: '/tmp/demo',
    systemPrompt: 'sys',
    userMessage: 'hi',
  };
}

const FIXTURES = {
  assistantText: JSON.stringify({
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'hello world' }],
  }),
  functionCall: JSON.stringify({
    type: 'function_call',
    call_id: 'call_1',
    name: 'bash',
    arguments: JSON.stringify({ command: 'ls' }),
  }),
  functionCallOutput: JSON.stringify({
    type: 'function_call_output',
    call_id: 'call_1',
    output: 'file1\nfile2',
    is_error: false,
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
    const lines = [FIXTURES.assistantText, FIXTURES.functionCall, FIXTURES.functionCallOutput];
    const child = new FakeChild(lines);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });

    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual([
      'assistant_text',
      'tool_call_start',
      'tool_call_end',
      'usage',
      'done',
    ]);
  });

  it('emits assistant_text event with correct delta', async () => {
    const child = new FakeChild([FIXTURES.assistantText]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const text = events.find((e) => e.kind === 'assistant_text');
    expect(text).toMatchObject({ delta: 'hello world' });
  });

  it('emits usage with zeros (codex CLI has no token counts)', async () => {
    const child = new FakeChild([FIXTURES.assistantText]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    const usage = events.find((e) => e.kind === 'usage');
    expect(usage).toMatchObject({
      kind: 'usage',
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0 },
    });
  });

  it('always emits done as the last event', async () => {
    const child = new FakeChild([FIXTURES.assistantText]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events[events.length - 1]?.kind).toBe('done');
  });

  it('tolerates malformed JSON lines without crashing', async () => {
    const lines = ['not json', '{ broken', FIXTURES.assistantText];
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

  it('throws when child process emits error (non-zero exit)', async () => {
    const child = new FakeChild([], 1);
    queueMicrotask(() => child.emit('error', new Error('ENOENT codex')));
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    await expect(collect(adapter)).rejects.toThrow('ENOENT codex');
  });

  it('kills the child on early break', async () => {
    const child = new OpenChild([FIXTURES.assistantText]);
    const adapter = new CodexAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const iterator = adapter.spawn(makeRequest())[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    await iterator.return?.(undefined);
    expect(child.killed).toBe(true);
    expect(child.signal).toBe('SIGTERM');
  });

  it('emits file_edit alongside tool_call_start for write_file', async () => {
    const writeCall = JSON.stringify({
      type: 'function_call',
      call_id: 'call_w',
      name: 'write_file',
      arguments: JSON.stringify({ path: '/tmp/out.ts', content: 'export {};' }),
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
  it('always returns 0', () => {
    const adapter = new CodexAdapter();
    expect(
      adapter.cost(
        { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, estimatedCostUsd: 0 },
        'codex-latest',
      ),
    ).toBe(0);
  });
});
