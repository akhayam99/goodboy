import type { ProviderId } from '@kay-am/types';
import { computeCostUsd } from '../providers/claude/cost';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import { parsePlannerOutput } from './parser';
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from './prompt';
import type { PlannerInput, PlannerOutput } from './types';

export interface PlannerUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly estimatedCostUsd: number;
}

export interface PlannerClientResult {
  readonly output: PlannerOutput;
  readonly usage: PlannerUsage;
  readonly model: string;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export interface PlannerClientDeps {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly invokeFn: InvokeFn;
}

export class PlannerClientSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`planner cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'PlannerClientSpawnError';
  }
}

interface ClaudeJsonResult {
  readonly result?: string;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
}

interface InvokeResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export class PlannerClient {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly invokeFn: InvokeFn;

  constructor(deps: PlannerClientDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? defaultBinary(deps.providerId);
    this.model = cheapModel(deps.providerId);
    this.invokeFn = deps.invokeFn;
  }

  async plan(input: PlannerInput): Promise<PlannerClientResult> {
    const userMessage = buildPlannerUserPrompt(input);
    const result = await this.invokeFn<InvokeResult>('planner_run', {
      args: {
        providerId: this.providerId,
        model: this.model,
        binary: this.binary,
        userMessage,
        systemPrompt: PLANNER_SYSTEM_PROMPT,
      },
    });

    if (result.exitCode !== 0) {
      throw new PlannerClientSpawnError(result.exitCode, result.stderr);
    }

    const { text, usage } = this.extractTextAndUsage(result.stdout);
    const output = parsePlannerOutput(text);
    return { output, usage, model: this.model };
  }

  private extractTextAndUsage(stdout: string): { text: string; usage: PlannerUsage } {
    if (this.providerId === 'anthropic') {
      return extractClaudeJsonOutput(stdout, this.model);
    }
    return { text: stdout.trim(), usage: zeroUsage() };
  }
}

function cheapModel(providerId: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[providerId];
  return caps.models.find((m) => m.tier === 'cheap')?.id ?? caps.models[0]!.id;
}

function defaultBinary(providerId: ProviderId): string {
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

function extractClaudeJsonOutput(
  stdout: string,
  model: string,
): { text: string; usage: PlannerUsage } {
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

function zeroUsage(): PlannerUsage {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0 };
}
