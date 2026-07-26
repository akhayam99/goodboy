import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId, TurnEvent, TurnRequest } from '@goodboy/types';
import { OpenCodeAdapter } from './adapter';

const AT = '2026-07-27T00:00:00.000Z' as IsoDateTime;

class FakeChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  exitCode: number | null = null;
  killed = false;

  constructor(lines: ReadonlyArray<string>) {
    super();
    this.stdout = Readable.from(lines.map((line) => `${line}\n`));
    this.stderr = Readable.from([]);
    queueMicrotask(() => {
      this.exitCode = 0;
      this.stdout.on('end', () => this.emit('close', 0));
    });
  }

  kill(): boolean {
    this.killed = true;
    this.exitCode = 143;
    return true;
  }
}

type RequestParams = {
  readonly model: string;
};

const requestFor = ({ model }: RequestParams): TurnRequest => ({
  runId: 'run_opencode' as ProviderRunId,
  sessionId: 'session_1' as SessionId,
  model,
  workingDir: '/tmp/project',
  systemPrompt: 'System',
  userMessage: 'Build it',
});

type CollectParams = {
  readonly adapter: OpenCodeAdapter;
  readonly request: TurnRequest;
};

const collect = async ({ adapter, request }: CollectParams): Promise<ReadonlyArray<TurnEvent>> => {
  const events: TurnEvent[] = [];
  for await (const event of adapter.spawn(request)) {
    events.push(event);
  }
  return events;
};

describe('OpenCodeAdapter', () => {
  it('uses the verified run flags and emits parsed events', async () => {
    const child = new FakeChild([
      JSON.stringify({
        type: 'text',
        sessionID: 'ses_1',
        part: { id: 'part_1', type: 'text', text: 'Done' },
      }),
    ]);
    const spawnFn = vi.fn((_binary: string, _args: ReadonlyArray<string>) => child);
    const adapter = new OpenCodeAdapter({ now: () => AT, spawnFn: spawnFn as never });
    const events = await collect({
      adapter,
      request: requestFor({ model: 'opencode/big-pickle' }),
    });
    expect(spawnFn).toHaveBeenCalledWith(
      'opencode',
      [
        'run',
        '--format',
        'json',
        '-m',
        'opencode/big-pickle',
        '--dir',
        '/tmp/project',
        '--dangerously-skip-permissions',
        'System\n\nBuild it',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    expect(events.map((event) => event.kind)).toEqual([
      'provider_session_init',
      'assistant_text',
      'done',
    ]);
  });

  it('keeps pre-slugged openrouter model ids unchanged', async () => {
    const child = new FakeChild([]);
    const spawnFn = vi.fn((_binary: string, _args: ReadonlyArray<string>) => child);
    const adapter = new OpenCodeAdapter({
      providerId: 'openrouter',
      now: () => AT,
      spawnFn: spawnFn as never,
    });
    await collect({
      adapter,
      request: requestFor({ model: 'openrouter/openai/gpt-5.4' }),
    });
    expect(spawnFn.mock.calls[0]?.[1]).toContain('openrouter/openai/gpt-5.4');
    expect(spawnFn.mock.calls[0]?.[1]).not.toContain('openrouter/openrouter/openai/gpt-5.4');
    expect(adapter.id).toBe('openrouter');
  });

  it('detects the bare opencode version', async () => {
    const child = new FakeChild(['1.14.48']);
    const adapter = new OpenCodeAdapter({ spawnFn: (() => child) as never });
    await expect(adapter.detect()).resolves.toEqual({
      kind: 'available',
      binary: 'opencode',
      version: '1.14.48',
    });
  });
});
