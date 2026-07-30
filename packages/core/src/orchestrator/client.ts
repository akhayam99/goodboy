import type { ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { computeProviderCostUsd } from '../providers/provider-cost';
import { cliModelId } from '../providers/cliModelId';
import { getDefaultBinary } from '../providers/cli-defaults';
import { parseOrchestratorDecision } from './parser';
import { buildOrchestratorUserPrompt, ORCHESTRATOR_SYSTEM_PROMPT } from './prompt';
import type { OrchestratorDecision, OrchestratorInput } from './types';

export type OrchestratorUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly estimatedCostUsd: number;
};

export type OrchestratorClientResult = {
  readonly decision: OrchestratorDecision | null;
  readonly usage: OrchestratorUsage;
  readonly model: string;
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export type OrchestratorClientDeps = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly binary?: string;
  readonly workingDir?: string;
  readonly timeoutMs?: number;
  readonly invokeFn: InvokeFn;
};

export class OrchestratorClientSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`orchestrator cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'OrchestratorClientSpawnError';
  }
}

type InvokeResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

const DEFAULT_TIMEOUT_MS = 120_000;

export class OrchestratorClient {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly workingDir: string | undefined;
  private readonly timeoutMs: number;
  private readonly invokeFn: InvokeFn;

  constructor(deps: OrchestratorClientDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = cliModelId({ provider: deps.providerId, model: deps.model });
    this.workingDir = deps.workingDir;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.invokeFn = deps.invokeFn;
  }

  async decide(input: OrchestratorInput): Promise<OrchestratorClientResult> {
    const userMessage = buildOrchestratorUserPrompt(input);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('orchestrator decision timed out')),
        this.timeoutMs,
      );
    });
    let result: InvokeResult;
    try {
      result = await Promise.race([
        this.invokeFn<InvokeResult>('planner_run', {
          args: {
            providerId: this.providerId,
            model: this.model,
            binary: this.binary,
            userMessage,
            systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
            ...(this.workingDir != null && { workingDir: this.workingDir }),
          },
        }),
        timeout,
      ]);
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
    if (result.exitCode !== 0) {
      throw new OrchestratorClientSpawnError(result.exitCode, result.stderr);
    }
    const extracted = extractAuxOutput({ providerId: this.providerId, stdout: result.stdout });
    const usage: OrchestratorUsage = {
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
    return {
      decision: parseOrchestratorDecision(extracted.text),
      usage,
      model: this.model,
    };
  }
}
