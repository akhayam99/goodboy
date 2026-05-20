import { spawn } from 'node:child_process';
import type { ProviderId } from '@goodboy/types';
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

export interface PlannerResult {
  readonly output: PlannerOutput;
  readonly usage: PlannerUsage;
  readonly model: string;
}

export interface PlannerAgentDeps {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly spawnFn?: typeof spawn;
}

export class PlannerSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`planner cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'PlannerSpawnError';
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

export class PlannerAgent {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly spawnFn: typeof spawn;

  constructor(deps: PlannerAgentDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? defaultBinary(deps.providerId);
    this.model = cheapModel(deps.providerId);
    this.spawnFn = deps.spawnFn ?? spawn;
  }

  async plan(input: PlannerInput): Promise<PlannerResult> {
    const userMessage = buildPlannerUserPrompt(input);
    const { stdout, stderr, exitCode } = await this.spawnCli(userMessage);

    if (exitCode !== 0) {
      throw new PlannerSpawnError(exitCode, stderr);
    }

    const { text, usage } = this.extractTextAndUsage(stdout);
    const output = parsePlannerOutput(text);
    return { output, usage, model: this.model };
  }

  private spawnCli(
    userMessage: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const args = buildCliArgs(this.providerId, this.model, PLANNER_SYSTEM_PROMPT, userMessage);
      const child = this.spawnFn(this.binary, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => reject(err));
      child.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
    });
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

function buildCliArgs(
  providerId: ProviderId,
  model: string,
  systemPrompt: string,
  userMessage: string,
): string[] {
  switch (providerId) {
    case 'anthropic':
      return [
        '-p',
        userMessage,
        '--model',
        model,
        '--system-prompt',
        systemPrompt,
        '--output-format',
        'json',
        '--no-session-persistence',
      ];
    case 'cursor':
      return [
        '-p',
        `${systemPrompt}\n\n${userMessage}`,
        '--model',
        model,
        '--output-format',
        'stream-json',
        '--force',
      ];
    case 'codex':
      return [
        'exec',
        '--json',
        '-m',
        model,
        '-s',
        'read-only',
        '--skip-git-repo-check',
        `${systemPrompt}\n\n${userMessage}`,
      ];
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
