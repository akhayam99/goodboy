import type { ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { computeProviderCostUsd } from '../providers/provider-cost';
import { cliModelId } from '../providers/cliModelId';
import { getDefaultBinary } from '../providers/cli-defaults';
import { parsePlannerOutput } from './parser';
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from './prompt';
import type { PlannerInput, PlannerOutput } from './types';

export type PlannerUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly estimatedCostUsd: number;
};

export type PlannerClientResult = {
  readonly output: PlannerOutput;
  readonly usage: PlannerUsage;
  readonly model: string;
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export type PlannerClientDeps = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: InvokeFn;
};

export class PlannerClientSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`planner cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'PlannerClientSpawnError';
  }
}

type InvokeResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

export class PlannerClient {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly workingDir: string | undefined;
  private readonly invokeFn: InvokeFn;

  constructor(deps: PlannerClientDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = cliModelId({ provider: deps.providerId, model: deps.model });
    this.workingDir = deps.workingDir;
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
        ...(this.workingDir != null && { workingDir: this.workingDir }),
      },
    });

    if (result.exitCode !== 0) {
      throw new PlannerClientSpawnError(result.exitCode, result.stderr);
    }

    const extracted = extractAuxOutput({ providerId: this.providerId, stdout: result.stdout });
    const usage: PlannerUsage = {
      ...extracted.usage,
      estimatedCostUsd: computeProviderCostUsd({
        providerId: this.providerId,
        usage: {
          ...extracted.usage,
          estimatedCostUsd: extracted.usage.estimatedCostUsd ?? 0,
        },
        model: this.model,
      }),
    };
    const output = parsePlannerOutput(extracted.text);
    return { output, usage, model: this.model };
  }
}
