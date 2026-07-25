import type { ContextSlot, ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { computeCostUsd } from '../providers/claude/cost';
import { getCheapModel, getDefaultBinary } from '../providers/cli-defaults';
import { isSlotKey, SLOT_KEYS, type SlotKey } from '../context/slots';
import { extractJson } from './extract-json';
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
};

export type SummarizerResult = {
  readonly delta: ContextSlotDelta;
  readonly usage: SummarizerUsage;
  readonly model: string;
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export type SummarizerDeps = {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly model?: string;
  readonly workingDir?: string;
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

export class SummarizerCliError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(`summarizer cli reported an error: ${message}`);
    this.name = 'SummarizerCliError';
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
  private readonly workingDir: string | undefined;
  private readonly invokeFn: InvokeFn;

  constructor(deps: SummarizerDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = deps.model ?? getCheapModel(deps.providerId);
    this.workingDir = deps.workingDir;
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
        ...(this.workingDir != null && { workingDir: this.workingDir }),
      },
    });

    if ((result.exitCode ?? 0) !== 0) {
      throw new SummarizerSpawnError(result.exitCode, result.stderr);
    }

    const output = extractAuxOutput({ providerId: this.providerId, stdout: result.stdout });
    if (output.isError) {
      throw new SummarizerCliError(output.errorMessage ?? 'unknown error', result.stdout);
    }
    const usage: SummarizerUsage = {
      ...output.usage,
      estimatedCostUsd: computeCostUsd({ ...output.usage, estimatedCostUsd: 0 }, this.model),
    };
    const delta = parseDelta(output.text);
    return { delta, usage, model: this.model };
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
    'When decisions is included in upserts it must be the full rewritten set. Omitting a slot means it is unchanged.',
    'Return the JSON object now.',
  ].join('\n');
}

function parseDelta(raw: string): ContextSlotDelta {
  const stripped = extractJson({ raw });
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
