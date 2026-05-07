import { describe, expect, it, vi } from 'vitest';
import { HAIKU_MODEL, Summarizer, SummarizerHttpError, SummarizerParseError } from './client';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
}

function makeAnthropicReply(text: string, usage: Usage = { input_tokens: 100, output_tokens: 20 }) {
  return {
    content: [{ type: 'text', text }],
    usage,
    model: HAIKU_MODEL,
  };
}

describe('Summarizer', () => {
  it('rejects construction without an api key', () => {
    expect(() => new Summarizer({ apiKey: '' })).toThrow(/api key/);
    expect(() => new Summarizer({ apiKey: '   ' })).toThrow(/api key/);
  });

  it('sends the expected request shape to the anthropic api', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(makeAnthropicReply(JSON.stringify({ upserts: [] }))),
    );
    const summarizer = new Summarizer({ apiKey: 'sk-ant-test', fetchFn });

    await summarizer.summarize({
      prevSlots: [],
      turnInput: 'do the thing',
      turnOutput: 'did the thing',
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0]!;
    const url = call[0];
    const init = call[1] as RequestInit;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(HAIKU_MODEL);
    expect(body.system).toContain('exactly five slots');
    expect(body.messages[0].content).toContain('do the thing');
    expect(body.messages[0].content).toContain('did the thing');
  });

  it('parses a valid delta and returns normalized usage + cost', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        makeAnthropicReply(
          JSON.stringify({
            upserts: [
              { key: 'goal', value: 'refactor auth' },
              { key: 'decisions', value: '- use jwt\n- 24h ttl' },
            ],
          }),
          { input_tokens: 1_000_000, output_tokens: 500_000, cache_read_input_tokens: 0 },
        ),
      ),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'plan auth',
      turnOutput: 'jwt 24h',
    });

    expect(result.delta.upserts).toEqual([
      { key: 'goal', value: 'refactor auth' },
      { key: 'decisions', value: '- use jwt\n- 24h ttl' },
    ]);
    expect(result.usage.inputTokens).toBe(1_000_000);
    expect(result.usage.outputTokens).toBe(500_000);
    // haiku pricing: $1 / MTok in, $5 / MTok out → 1 + 2.5 = 3.5
    expect(result.usage.estimatedCostUsd).toBeCloseTo(3.5);
    expect(result.model).toBe(HAIKU_MODEL);
  });

  it('strips ```json code fences before parsing', async () => {
    const fenced = '```json\n{ "upserts": [{"key": "goal", "value": "x"}] }\n```';
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(makeAnthropicReply(fenced)));
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'a',
      turnOutput: 'b',
    });
    expect(result.delta.upserts).toEqual([{ key: 'goal', value: 'x' }]);
  });

  it('drops upsert entries with unknown slot keys', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        makeAnthropicReply(
          JSON.stringify({
            upserts: [
              { key: 'goal', value: 'ok' },
              { key: 'mystery_slot', value: 'nope' },
              { key: 'decisions', value: 'keep' },
            ],
          }),
        ),
      ),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'a',
      turnOutput: 'b',
    });
    expect(result.delta.upserts.map((u) => u.key)).toEqual(['goal', 'decisions']);
  });

  it('throws SummarizerParseError on non-json response', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(makeAnthropicReply('hello, not json')),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    await expect(
      summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });

  it('throws SummarizerParseError when upserts is missing', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(makeAnthropicReply(JSON.stringify({ other: 'shape' }))),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    await expect(
      summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });

  it('throws SummarizerHttpError on non-2xx response', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('rate limited', { status: 429 }));
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    const err = await summarizer
      .summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SummarizerHttpError);
    expect((err as SummarizerHttpError).status).toBe(429);
    expect((err as SummarizerHttpError).body).toBe('rate limited');
  });

  it('does not log or expose the api key on errors', async () => {
    const apiKey = 'sk-ant-very-secret';
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('boom', { status: 500 }));
    const summarizer = new Summarizer({ apiKey, fetchFn });
    let captured: SummarizerHttpError | null = null;
    try {
      await summarizer.summarize({ prevSlots: [], turnInput: 'a', turnOutput: 'b' });
    } catch (e) {
      captured = e as SummarizerHttpError;
    }
    expect(captured).not.toBeNull();
    expect(captured!.message).not.toContain(apiKey);
    expect(captured!.body).not.toContain(apiKey);
  });

  it('includes previous slot values in the prompt body', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(makeAnthropicReply(JSON.stringify({ upserts: [] }))),
    );
    const summarizer = new Summarizer({ apiKey: 'sk', fetchFn });
    await summarizer.summarize({
      prevSlots: [{ key: 'goal', value: 'auth refactor', enabled: true }],
      turnInput: 'q',
      turnOutput: 'a',
    });
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toContain('goal: auth refactor');
  });
});
