import type { ContextSlot, ProviderId } from '@goodboy/types';
import { computeCostUsd } from '../providers/claude/cost';
import { getCheapModel, getDefaultBinary } from '../providers/cli-defaults';
import { isSlotKey, SLOT_KEYS, type SlotKey } from '../context/slots';
import { inferNextActions, type NextAction, type NextActionsPrState } from './next-actions';
import { SUMMARIZER_SYSTEM_PROMPT } from './prompt';

export type ContextSlotDeltaUpsert = Readonly<{ key: SlotKey; value: string }>;

export type ContextSlotDelta = Readonly<{
  upserts: ReadonlyArray<ContextSlotDeltaUpsert>;
}>;

export type SummarizerUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly estimatedCostUsd: number;
};

export type SummarizeInput = {
  readonly prevSlots: ReadonlyArray<ContextSlot>;
  readonly turnInput: string;
  readonly turnOutput: string;
  readonly prState?: NextActionsPrState | null;
};

export type SummarizerResult = {
  readonly delta: ContextSlotDelta;
  readonly usage: SummarizerUsage;
  readonly model: string;
  readonly nextActions: ReadonlyArray<NextAction>;
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export type SummarizerDeps = {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly model?: string;
  readonly invokeFn: InvokeFn;
};

export class SummarizerSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`summarizer cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'SummarizerSpawnError';
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

type SummarizeCommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

export class Summarizer {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly invokeFn: InvokeFn;

  constructor(deps: SummarizerDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = deps.model ?? getCheapModel(deps.providerId);
    this.invokeFn = deps.invokeFn;
  }

  async summarize(input: SummarizeInput): Promise<SummarizerResult> {
    const userMessage = buildUserPrompt(input);

    const result = await this.invokeFn<SummarizeCommandResult>('summarize_session', {
      args: {
        providerId: this.providerId,
        model: this.model,
        binary: this.binary,
        userMessage,
        systemPrompt: SUMMARIZER_SYSTEM_PROMPT,
      },
    });

    if ((result.exitCode ?? 0) !== 0) {
      throw new SummarizerSpawnError(result.exitCode, result.stderr);
    }

    const { text, usage } = extractTextAndUsage(this.providerId, result.stdout, this.model);
    const delta = parseDelta(text);
    const slotsAfter = applyDelta(input.prevSlots, delta);
    const nextActions = inferNextActions({
      input,
      delta,
      slotsAfter,
      prState: input.prState ?? null,
    });
    return { delta, usage, model: this.model, nextActions };
  }
}

function applyDelta(
  prev: ReadonlyArray<ContextSlot>,
  delta: ContextSlotDelta,
): ReadonlyArray<ContextSlot> {
  if (delta.upserts.length === 0) {
    return prev;
  }
  const byKey = new Map<string, ContextSlot>(prev.map((s) => [s.key, s]));
  for (const upsert of delta.upserts) {
    const existing = byKey.get(upsert.key);
    byKey.set(upsert.key, {
      key: upsert.key,
      value: upsert.value,
      enabled: existing?.enabled ?? true,
    });
  }
  return Array.from(byKey.values());
}

type ClaudeJsonResult = {
  readonly result?: string;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
  readonly subtype?: string;
  readonly is_error?: boolean;
};

function extractTextAndUsage(
  providerId: ProviderId,
  stdout: string,
  model: string,
): { text: string; usage: SummarizerUsage } {
  if (providerId === 'anthropic') {
    return extractClaudeJsonOutput(stdout, model);
  }
  return { text: stdout.trim(), usage: zeroUsage() };
}

function extractClaudeJsonOutput(
  stdout: string,
  model: string,
): { text: string; usage: SummarizerUsage } {
  const trimmed = stdout.trim();
  let parsed: ClaudeJsonResult;
  try {
    parsed = JSON.parse(trimmed) as ClaudeJsonResult;
  } catch {
    return { text: trimmed, usage: zeroUsage() };
  }

  const text = parsed.result ?? '';
  const rawUsage = parsed.usage ?? {};
  const inputTokens = rawUsage.input_tokens ?? 0;
  const outputTokens = rawUsage.output_tokens ?? 0;
  const cachedInputTokens = rawUsage.cache_read_input_tokens ?? 0;
  const estimatedCostUsd = computeCostUsd(
    { inputTokens, outputTokens, cachedInputTokens, estimatedCostUsd: 0 },
    model,
  );
  return { text, usage: { inputTokens, outputTokens, cachedInputTokens, estimatedCostUsd } };
}

function zeroUsage(): SummarizerUsage {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0 };
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
  const stripped = extractJson(raw);
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
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const e = entry as Record<string, unknown>;
    const key = e.key;
    const value = e.value;
    if (typeof key !== 'string' || !isSlotKey(key)) {
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    upserts.push({ key, value });
  }
  return { upserts };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();

  const edgeFence = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(trimmed);
  if (edgeFence?.[1]) {
    return edgeFence[1].trim();
  }

  const innerFence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (innerFence?.[1]) {
    return innerFence[1].trim();
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced !== null) {
    return balanced;
  }

  return trimmed;
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
