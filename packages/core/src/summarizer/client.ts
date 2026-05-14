import type { ContextSlot, ProviderId } from '@kay-am/types';
import { computeCostUsd } from '../providers/claude/cost';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import { isSlotKey, SLOT_KEYS, SLOT_LABELS, type SlotKey } from '../context/slots';
import { inferNextActions, type NextAction, type NextActionsPrState } from './next-actions';

function getCheapModel(providerId: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[providerId];
  return caps.models.find((m) => m.tier === 'cheap')?.id ?? caps.models[0]!.id;
}

function getDefaultBinary(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude';
    case 'cursor':
      return 'cursor-agent';
    case 'codex':
      return 'codex';
    default: {
      const _exhaustive: never = providerId;
      throw new Error(`unknown provider: ${_exhaustive}`);
    }
  }
}

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
  readonly prState?: NextActionsPrState | null;
}

export interface SummarizerResult {
  readonly delta: ContextSlotDelta;
  readonly usage: SummarizerUsage;
  readonly model: string;
  readonly nextActions: ReadonlyArray<NextAction>;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export interface SummarizerDeps {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly invokeFn: InvokeFn;
}

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

interface SummarizeCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

const SYSTEM_PROMPT = `You maintain a small structured summary for an AI coding session. The summary is the handoff payload — a fresh agent must be able to read these slots alone and continue the work without seeing any prior turns.

There are exactly five slots, each with a stable key:
${SLOT_KEYS.map((k) => `- ${k} (${SLOT_LABELS[k]})`).join('\n')}

You will receive the previous slot values plus the most recent user turn and assistant turn.
Decide which slots, if any, should change. Keep values terse: a sentence or short bullet list per slot. Prefer decisions, constraints, and unresolved items over verbose narration of what happened. Exclude raw tool output.

Goal refinement: the "goal" slot is not write-once. As the conversation clarifies what the user actually wants, sharpen the goal — make it more specific, surface implicit constraints, drop vague phrasing. Update goal whenever the latest turn changed or clarified the target. Don't rewrite when nothing new emerged.

Open questions: when the latest user turn answers a previously-listed open question, drop the resolved item from the open_questions slot value. Add new questions only when the assistant explicitly needs the user before continuing.

You MUST respond with a single JSON object and nothing else. No prose, no markdown, no code fences.
The schema is:
{ "upserts": [ { "key": "<one of the five keys>", "value": "<new slot value>" } ] }

Only include slots that should change. Omit slots that stay the same. Never invent new keys.
If nothing should change, return { "upserts": [] }.`;

export class Summarizer {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly invokeFn: InvokeFn;

  constructor(deps: SummarizerDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = getCheapModel(deps.providerId);
    this.invokeFn = deps.invokeFn;
  }

  async summarize(input: SummarizeInput): Promise<SummarizerResult> {
    const userMessage = buildUserPrompt(input);

    const result = await this.invokeFn<SummarizeCommandResult>('summarize_task', {
      args: {
        providerId: this.providerId,
        model: this.model,
        binary: this.binary,
        userMessage,
        systemPrompt: SYSTEM_PROMPT,
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
  if (delta.upserts.length === 0) return prev;
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

interface ClaudeJsonResult {
  readonly result?: string;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
  readonly subtype?: string;
  readonly is_error?: boolean;
}

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
