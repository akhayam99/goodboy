import type { ContextSlot, IsoDateTime } from '@kay-am/types';
import { isSlotKey, SLOT_KEYS, SLOT_LABELS, type SlotKey } from '../context/slots';
import { computeCostUsd } from '../providers/claude/cost';

export const HAIKU_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 512;

export type ContextSlotDeltaUpsert = Readonly<{ key: SlotKey; value: string }>;

export type ContextSlotDelta = Readonly<{
  upserts: ReadonlyArray<ContextSlotDeltaUpsert>;
}>;

export interface SummarizerUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly estimatedCostUsd: number;
}

export interface SummarizeInput {
  readonly prevSlots: ReadonlyArray<ContextSlot>;
  readonly turnInput: string;
  readonly turnOutput: string;
}

export interface SummarizerResult {
  readonly delta: ContextSlotDelta;
  readonly usage: SummarizerUsage;
  readonly model: string;
}

export interface SummarizerDeps {
  readonly apiKey: string;
  readonly model?: string;
  readonly fetchFn?: typeof fetch;
  readonly now?: () => IsoDateTime;
  readonly maxTokens?: number;
}

export class SummarizerHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`anthropic api error: ${status}`);
    this.name = 'SummarizerHttpError';
  }
}

export class SummarizerParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = 'SummarizerParseError';
  }
}

interface AnthropicMessageResponse {
  readonly content?: ReadonlyArray<{ type: string; text?: string }>;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
  readonly model?: string;
}

const SYSTEM_PROMPT = `You maintain a small structured summary for an AI coding session.

There are exactly five slots, each with a stable key:
${SLOT_KEYS.map((k) => `- ${k} (${SLOT_LABELS[k]})`).join('\n')}

You will receive the previous slot values plus the most recent user turn and assistant turn.
Decide which slots, if any, should change. Keep values terse: a sentence or short bullet list per slot.

You MUST respond with a single JSON object and nothing else. No prose, no markdown, no code fences.
The schema is:
{ "upserts": [ { "key": "<one of the five keys>", "value": "<new slot value>" } ] }

Only include slots that should change. Omit slots that stay the same. Never invent new keys.
If nothing should change, return { "upserts": [] }.`;

export class Summarizer {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly maxTokens: number;

  constructor(deps: SummarizerDeps) {
    if (!deps.apiKey || deps.apiKey.trim().length === 0) {
      throw new Error('summarizer requires an anthropic api key');
    }
    this.apiKey = deps.apiKey;
    this.model = deps.model ?? HAIKU_MODEL;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.maxTokens = deps.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async summarize(input: SummarizeInput): Promise<SummarizerResult> {
    const userMessage = buildUserPrompt(input);

    const response = await this.fetchFn(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new SummarizerHttpError(response.status, body);
    }

    const payload = (await response.json()) as AnthropicMessageResponse;
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    const delta = parseDelta(text);
    const usage = this.normalizeUsage(payload);

    return { delta, usage, model: payload.model ?? this.model };
  }

  private normalizeUsage(payload: AnthropicMessageResponse): SummarizerUsage {
    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const cachedInputTokens = payload.usage?.cache_read_input_tokens ?? 0;
    const estimatedCostUsd = computeCostUsd(
      { inputTokens, outputTokens, cachedInputTokens, estimatedCostUsd: 0 },
      this.model,
    );
    return { inputTokens, outputTokens, cachedInputTokens, estimatedCostUsd };
  }
}

function buildUserPrompt(input: SummarizeInput): string {
  const slotLines = SLOT_KEYS.map((key) => {
    const slot = input.prevSlots.find((s) => s.key === key);
    const value = slot?.enabled ? slot.value || '(empty)' : '(empty)';
    return `${key}: ${value}`;
  }).join('\n');

  return [
    'Current slot values:',
    slotLines,
    '',
    'User turn:',
    input.turnInput,
    '',
    'Assistant turn:',
    input.turnOutput,
    '',
    'Return the JSON object now.',
  ].join('\n');
}

function parseDelta(raw: string): ContextSlotDelta {
  const stripped = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new SummarizerParseError(
      `summarizer response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || !('upserts' in parsed)) {
    throw new SummarizerParseError('summarizer response missing "upserts" array', raw);
  }
  const candidate = (parsed as { upserts: unknown }).upserts;
  if (!Array.isArray(candidate)) {
    throw new SummarizerParseError('summarizer "upserts" was not an array', raw);
  }

  const upserts: ContextSlotDeltaUpsert[] = [];
  for (const entry of candidate) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const key = e.key;
    const value = e.value;
    if (typeof key !== 'string' || !isSlotKey(key)) continue;
    if (typeof value !== 'string') continue;
    upserts.push({ key, value });
  }
  return { upserts };
}

function stripCodeFences(raw: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
  return (fenced?.[1] ?? raw).trim();
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
