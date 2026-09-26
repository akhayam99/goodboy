import type { ContextSlot, EffortLevel, ProviderId, SessionDecision } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { computeProviderCostUsd } from '../providers/provider-cost';
import { getCheapModel, getDefaultBinary } from '../providers/cli-defaults';
import { cliModelId } from '../providers/cliModelId';
import { isSlotKey, SLOT_KEYS, type SlotKey } from '../context/slots';
import { activeDecisionsNewestFirst, CONSOLIDATION_OP_KINDS } from '../context/decisions-ledger';
import { parseDecisionOps, type SummarizerDecisionOp } from './decision-ops';
import { extractJson } from './extract-json';
import { SUMMARIZER_SYSTEM_PROMPT } from './prompt';

export type ContextSlotDeltaUpsert = Readonly<{ key: SlotKey; value: string }>;

export type ContextSlotDelta = Readonly<{
  upserts: ReadonlyArray<ContextSlotDeltaUpsert>;
  decisionOps: ReadonlyArray<SummarizerDecisionOp>;
}>;

export type SummarizeMode = 'turn' | 'consolidate';

export type SummarizerUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly estimatedCostUsd: number;
};

export type SummarizeInput = {
  readonly prevSlots: ReadonlyArray<ContextSlot>;
  readonly turnInput: string;
  readonly turnOutput: string;
  readonly decisions?: ReadonlyArray<SessionDecision>;
  readonly mode?: SummarizeMode;
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
  readonly effort?: EffortLevel;
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

export class Summarizer {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly effort: EffortLevel | undefined;
  private readonly workingDir: string | undefined;
  private readonly invokeFn: InvokeFn;

  constructor(deps: SummarizerDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = cliModelId({
      provider: deps.providerId,
      model: deps.model ?? getCheapModel(deps.providerId),
    });
    this.effort = deps.effort;
    this.workingDir = deps.workingDir;
    this.invokeFn = deps.invokeFn;
  }

  async summarize(input: SummarizeInput): Promise<SummarizerResult> {
    const userMessage = buildUserPrompt(input);

    const result = await runAuxOneShot({
      providerId: this.providerId,
      model: this.model,
      binary: this.binary,
      userMessage,
      systemPrompt: SUMMARIZER_SYSTEM_PROMPT,
      ...(this.effort != null && { effort: this.effort }),
      ...(this.workingDir != null && { workingDir: this.workingDir }),
      invokeFn: this.invokeFn,
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
      estimatedCostUsd: computeProviderCostUsd({
        providerId: this.providerId,
        usage: {
          ...output.usage,
          estimatedCostUsd: output.usage.estimatedCostUsd ?? 0,
        },
        model: this.model,
      }),
    };
    const delta = parseDelta({ raw: output.text, mode: input.mode ?? 'turn' });
    return { delta, usage, model: this.model };
  }
}

type DecisionsLineParams = {
  readonly decisions: ReadonlyArray<SessionDecision>;
};

const decisionsLine = ({ decisions }: DecisionsLineParams): string => {
  const active = activeDecisionsNewestFirst({ ledger: decisions });
  if (active.length === 0) {
    return '(empty)';
  }
  return active
    .map((row) => {
      const [first = '', ...rest] = row.text.split('\n');
      const owner = row.author === 'user' ? ' (yours)' : '';
      return [`- D${row.number} ${first}${owner}`, ...rest].join('\n');
    })
    .join('\n');
};

const CONSOLIDATION_REQUEST =
  'CONSOLIDATION pass: there is no new turn. Merge near-duplicate decisions and withdraw those that no longer hold, each withdraw with its reason; rewrite last_output_summary as final.';

function buildUserPrompt(input: SummarizeInput): string {
  const slotLines = SLOT_KEYS.map((key) => {
    if (key === 'decisions' && input.decisions !== undefined) {
      return `${key}:\n${decisionsLine({ decisions: input.decisions })}`;
    }
    const slot = input.prevSlots.find((s) => s.key === key);
    const value = slot?.enabled ? slot.value || '(empty)' : '(empty)';
    return `${key}: ${value}`;
  }).join('\n');

  if (input.mode === 'consolidate') {
    return [
      'Current slot values:',
      slotLines,
      '',
      CONSOLIDATION_REQUEST,
      'Return the JSON object now.',
    ].join('\n');
  }

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
    'Change decisions only through decisionOps. A decision you do not name stays as it is. Omitting a slot means it is unchanged.',
    'Return the JSON object now.',
  ].join('\n');
}

type ParseParams = {
  readonly raw: string;
  readonly mode: SummarizeMode;
};

const parseDelta = ({ raw, mode }: ParseParams): ContextSlotDelta => {
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
    if (typeof key !== 'string' || !isSlotKey(key) || key === 'decisions') {
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    upserts.push({ key, value });
  }

  const opsValue: unknown = 'decisionOps' in parsed ? parsed.decisionOps : undefined;
  const ops = parseDecisionOps({ value: opsValue });
  if (ops.kind === 'invalid') {
    throw new SummarizerParseError(`summarizer "decisionOps" was invalid: ${ops.message}`, raw);
  }
  const decisionOps =
    mode === 'consolidate' ? ops.ops.filter((op) => CONSOLIDATION_OP_KINDS.has(op.kind)) : ops.ops;
  return { upserts, decisionOps };
};
