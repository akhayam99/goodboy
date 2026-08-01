import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId, TurnEvent, TurnRequest } from '@goodboy/types';
import { GeminiAdapter } from './adapter';
import { GEMINI_DEFAULT_MODEL } from './constants';

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
    runId: 'run_gemini' as ProviderRunId,
    sessionId: 'sess_1' as SessionId,
    model: GEMINI_DEFAULT_MODEL,
    workingDir: '/tmp/demo',
    systemPrompt: 'sys',
    userMessage: 'hi',
  };
}

async function collect(adapter: GeminiAdapter, request?: TurnRequest): Promise<TurnEvent[]> {
  const events: TurnEvent[] = [];
  for await (const event of adapter.spawn(request ?? makeRequest())) {
    events.push(event);
  }
  return events;
}

describe('GeminiAdapter.spawn', () => {
  it('treats plain-text stdout lines as assistant_text, sealed with done', async () => {
    const child = new FakeChild(['Hello from gemini', 'second line']);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.map((e) => e.kind)).toEqual(['assistant_text', 'assistant_text', 'done']);
    expect(events[0]).toMatchObject({ delta: 'Hello from gemini\n' });
  });

  it('streams agent response text from structured output', async () => {
    const line = JSON.stringify({
      event: 'step_update',
      step_update: {
        state: 'ACTIVE',
        step_type: 'agent_response',
        text_delta: 'streamed',
      },
    });
    const child = new FakeChild([line]);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.find((e) => e.kind === 'assistant_text')).toMatchObject({ delta: 'streamed' });
  });

  it('emits usage with token counts from the final result', async () => {
    const line = JSON.stringify({
      event: 'result',
      result: {
        status: 'SUCCESS',
        usage: { input_tokens: 100, cache_read_tokens: 30, output_tokens: 50 },
      },
    });
    const child = new FakeChild([line]);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.find((e) => e.kind === 'usage')).toMatchObject({
      kind: 'usage',
      usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 30, estimatedCostUsd: 0 },
    });
  });

  it('surfaces a failed final result as an error event', async () => {
    const line = JSON.stringify({
      event: 'result',
      result: { status: 'FAILED', error: 'quota exceeded' },
    });
    const child = new FakeChild([line]);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events.find((e) => e.kind === 'error')).toMatchObject({
      message: 'FAILED: quota exceeded',
    });
  });

  it('always emits done as the last event', async () => {
    const child = new FakeChild(['anything']);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const events = await collect(adapter);
    expect(events[events.length - 1]?.kind).toBe('done');
  });

  it('throws when the child process emits error', async () => {
    const child = new FakeChild([], 1);
    queueMicrotask(() => child.emit('error', new Error('ENOENT gemini')));
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    await expect(collect(adapter)).rejects.toThrow('ENOENT gemini');
  });

  it('passes the model with --model and a supported --effort because agy rejects a bare model', async () => {
    let captured: ReadonlyArray<string> = [];
    let capturedBin = '';
    const child = new FakeChild(['ok']);
    const spawnFn = ((bin: string, args: ReadonlyArray<string>) => {
      capturedBin = bin;
      captured = args;
      return child;
    }) as never;
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn });
    await collect(adapter);
    expect(capturedBin).toBe('agy');
    expect(captured).toEqual([
      '-p',
      'sys\n\nhi',
      '--output-format',
      'stream-json',
      '--model',
      GEMINI_DEFAULT_MODEL,
      '--effort',
      'medium',
      '--sandbox',
    ]);
  });

  it('clamps an unsupported effort to one declared by the selected model', async () => {
    let captured: ReadonlyArray<string> = [];
    const child = new FakeChild(['ok']);
    const spawnFn = ((_: string, args: ReadonlyArray<string>) => {
      captured = args;
      return child;
    }) as never;
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn });
    await collect(adapter, {
      ...makeRequest(),
      model: 'gemini-3.1-pro',
      selection: { key: 'gemini-3.1-pro', effort: 'medium' },
    });
    expect(captured.slice(2, 4)).toEqual(['--output-format', 'stream-json']);
    expect(captured.slice(4, 8)).toEqual(['--model', 'gemini-3.1-pro', '--effort', 'low']);
  });

  it('kills the child on early break', async () => {
    const child = new OpenChild(['line one']);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const iterator = adapter.spawn(makeRequest())[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    await iterator.return?.(undefined);
    expect(child.killed).toBe(true);
    expect(child.signal).toBe('SIGTERM');
  });
});

describe('GeminiAdapter.detect', () => {
  it('returns available on exit 0', async () => {
    const child = new FakeChild(['0.5.0']);
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const result = await adapter.detect();
    expect(result.kind).toBe('available');
  });

  it('returns missing on spawn error', async () => {
    const child = new FakeChild([]);
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    const adapter = new GeminiAdapter({ now: fakeNow, spawnFn: (() => child) as never });
    const result = await adapter.detect();
    expect(result.kind).toBe('missing');
  });
});

describe('GeminiAdapter.cost', () => {
  it('prices the catalog default without an injected override', () => {
    const adapter = new GeminiAdapter();
    expect(
      adapter.cost(
        {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cachedInputTokens: 0,
          estimatedCostUsd: 0,
        },
        GEMINI_DEFAULT_MODEL,
      ),
    ).toBeCloseTo(10.5);
  });

  it('bills cached input at the catalog discount', () => {
    const adapter = new GeminiAdapter();
    expect(
      adapter.cost(
        {
          inputTokens: 2_000_000,
          outputTokens: 0,
          cachedInputTokens: 1_000_000,
          estimatedCostUsd: 0,
        },
        GEMINI_DEFAULT_MODEL,
      ),
    ).toBeCloseTo(1.5 + 0.15);
  });
});
