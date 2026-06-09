import { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { Summarizer, SummarizerParseError, SummarizerSpawnError } from './cli';

type MockChild = EventEmitter & {
  stdout: Readable;
  stderr: Readable;
  killed: boolean;
  exitCode: number | null;
  kill(signal?: NodeJS.Signals | string): boolean;
};

function makeMockSpawn(
  stdoutData: string,
  stderrData: string = '',
  exitCode: number = 0,
): { spawnFn: typeof import('node:child_process').spawn; child: MockChild } {
  const child = new EventEmitter() as MockChild;
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  child.killed = false;
  child.exitCode = null;
  child.kill = () => {
    child.killed = true;
    return true;
  };

  const spawnFn = vi.fn().mockImplementation(() => {
    setImmediate(() => {
      if (stdoutData) {
        child.stdout.push(stdoutData);
      }
      child.stdout.push(null);
      if (stderrData) {
        child.stderr.push(stderrData);
      }
      child.stderr.push(null);
      setImmediate(() => child.emit('close', exitCode));
    });
    return child as unknown as ChildProcess;
  }) as unknown as typeof import('node:child_process').spawn;

  return { spawnFn, child };
}

function makeClaudeJsonOutput(text: string, inputTokens = 100, outputTokens = 20): string {
  return JSON.stringify({
    result: text,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    subtype: 'success',
    is_error: false,
  });
}

describe('Summarizer (CLI-based)', () => {
  it('spawns claude CLI with correct args for anthropic provider', async () => {
    const { spawnFn } = makeMockSpawn(makeClaudeJsonOutput(JSON.stringify({ upserts: [] })));
    const summarizer = new Summarizer({ providerId: 'anthropic', spawnFn });

    await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [binary, args] = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(binary).toBe('claude');
    expect(args).toContain('-p');
    expect(args).toContain('--model');
    expect(args).toContain('claude-haiku-4-5');
    expect(args).toContain('--system-prompt');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--no-session-persistence');
  });

  it('spawns cursor-agent CLI with correct args for cursor provider', async () => {
    const { spawnFn } = makeMockSpawn(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    const [binary, args] = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(binary).toBe('cursor-agent');
    expect(args).toContain('-p');
    expect(args).toContain('--model');
    expect(args).toContain('composer-2-fast');
    expect(args).toContain('--force');
  });

  it('spawns codex CLI with correct args for codex provider', async () => {
    const { spawnFn } = makeMockSpawn(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'codex', spawnFn });

    await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    const [binary, args] = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(binary).toBe('codex');
    expect(args[0]).toBe('exec');
    expect(args).toContain('-m');
    expect(args).toContain('gpt-5.4-mini');
    expect(args).toContain('--skip-git-repo-check');
  });

  it('respects custom binary override', async () => {
    const { spawnFn } = makeMockSpawn(makeClaudeJsonOutput(JSON.stringify({ upserts: [] })));
    const summarizer = new Summarizer({
      providerId: 'anthropic',
      binary: '/custom/claude',
      spawnFn,
    });

    await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    const [binary] = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]];
    expect(binary).toBe('/custom/claude');
  });

  it('parses a valid delta from anthropic json output', async () => {
    const delta = { upserts: [{ key: 'goal', value: 'refactor auth' }] };
    const { spawnFn } = makeMockSpawn(
      makeClaudeJsonOutput(JSON.stringify(delta), 1_000_000, 500_000),
    );
    const summarizer = new Summarizer({ providerId: 'anthropic', spawnFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'plan auth',
      turnOutput: 'jwt 24h',
    });

    expect(result.delta.upserts).toEqual([{ key: 'goal', value: 'refactor auth' }]);
    expect(result.usage.inputTokens).toBe(1_000_000);
    expect(result.usage.outputTokens).toBe(500_000);
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.model).toBe('claude-haiku-4-5');
  });

  it('parses plain json text from cursor provider', async () => {
    const delta = { upserts: [{ key: 'decisions', value: 'use sqlite' }] };
    const { spawnFn } = makeMockSpawn(JSON.stringify(delta));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const result = await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    expect(result.delta.upserts).toEqual([{ key: 'decisions', value: 'use sqlite' }]);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.estimatedCostUsd).toBe(0);
  });

  it('strips ```json code fences before parsing', async () => {
    const fenced = '```json\n{ "upserts": [{"key": "goal", "value": "x"}] }\n```';
    const { spawnFn } = makeMockSpawn(fenced);
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const result = await summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' });
    expect(result.delta.upserts).toEqual([{ key: 'goal', value: 'x' }]);
  });

  it('drops upsert entries with unknown slot keys', async () => {
    const delta = {
      upserts: [
        { key: 'goal', value: 'ok' },
        { key: 'mystery_slot', value: 'nope' },
        { key: 'decisions', value: 'keep' },
      ],
    };
    const { spawnFn } = makeMockSpawn(JSON.stringify(delta));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    const result = await summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' });
    expect(result.delta.upserts.map((u) => u.key)).toEqual(['goal', 'decisions']);
  });

  it('throws SummarizerParseError on non-json response', async () => {
    const { spawnFn } = makeMockSpawn('hello, not json');
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    await expect(
      summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });

  it('throws SummarizerParseError when upserts is missing', async () => {
    const { spawnFn } = makeMockSpawn(JSON.stringify({ other: 'shape' }));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    await expect(
      summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });

  it('throws SummarizerSpawnError on non-zero exit code', async () => {
    const { spawnFn } = makeMockSpawn('', 'rate limited', 1);
    const summarizer = new Summarizer({ providerId: 'anthropic', spawnFn });

    const err = await summarizer
      .summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SummarizerSpawnError);
    expect((err as SummarizerSpawnError).exitCode).toBe(1);
    expect((err as SummarizerSpawnError).stderr).toBe('rate limited');
  });

  it('includes previous slot values in the prompt', async () => {
    const { spawnFn } = makeMockSpawn(makeClaudeJsonOutput(JSON.stringify({ upserts: [] })));
    const summarizer = new Summarizer({ providerId: 'anthropic', spawnFn });

    await summarizer.summarize({
      prevSlots: [{ key: 'goal', value: 'auth refactor', enabled: true }],
      turnInput: 'q',
      turnOutput: 'a',
    });

    const args = ((spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]])[1];
    const promptArg = args[args.indexOf('-p') + 1];
    expect(promptArg).toContain('goal: auth refactor');
  });

  it('includes system prompt in cursor prompt arg (no --system-prompt flag)', async () => {
    const { spawnFn } = makeMockSpawn(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'cursor', spawnFn });

    await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });

    const args = ((spawnFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]])[1];
    expect(args).not.toContain('--system-prompt');
    const promptArg = args[args.indexOf('-p') + 1];
    expect(promptArg).toContain('exactly five slots');
  });

  it('returns zero usage for codex provider', async () => {
    const { spawnFn } = makeMockSpawn(JSON.stringify({ upserts: [] }));
    const summarizer = new Summarizer({ providerId: 'codex', spawnFn });

    const result = await summarizer.summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' });
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.estimatedCostUsd).toBe(0);
  });

  it('falls back to raw stdout as text if claude json output lacks result field', async () => {
    const rawText = JSON.stringify({ upserts: [{ key: 'goal', value: 'fallback' }] });
    const claudeJsonMissingResult = JSON.stringify({ subtype: 'success', usage: {} });
    const { spawnFn } = makeMockSpawn(claudeJsonMissingResult + '\n' + rawText);
    const summarizer = new Summarizer({ providerId: 'anthropic', spawnFn });

    const err = await summarizer
      .summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SummarizerParseError);
  });
});
