import { spawn } from 'node:child_process';
import type {
  DetectResult,
  IsoDateTime,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderUsage,
  TurnEvent,
  TurnRequest,
} from '@kay-am/types';
import { detectBinary, spawnLineStream } from '../shared/spawn-stream';
import { CODEX_DEFAULT_MODEL, CODEX_MODELS } from './constants';
import { computeCodexCostUsd, type CodexModelPriceOverride } from './cost';
import { parseJsonLine } from './parser';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 200_000,
  defaultModel: CODEX_DEFAULT_MODEL,
  availableModels: CODEX_MODELS.map((m) => m.id),
};

export interface CodexAdapterDeps {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
  readonly priceOverride?: CodexModelPriceOverride | null;
}

export class CodexAdapter implements ProviderAdapter {
  readonly id = 'codex' as const;
  readonly capabilities = CAPABILITIES;

  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;
  private readonly priceOverride: CodexModelPriceOverride | null;

  constructor(deps: CodexAdapterDeps = {}) {
    this.binary = deps.binary ?? 'codex';
    this.now = deps.now ?? (() => new Date().toISOString() as IsoDateTime);
    this.spawnFn = deps.spawnFn ?? spawn;
    this.onUnknown = deps.onUnknown ?? (() => undefined);
    this.priceOverride = deps.priceOverride ?? null;
  }

  async detect(): Promise<DetectResult> {
    return detectBinary(this.binary, this.spawnFn);
  }

  // ChatGPT-login users are unmetered; API-key users can wire a price override
  // via CodexAdapterDeps.priceOverride to surface estimated USD.
  cost(usage: ProviderUsage, model: string): number {
    return computeCodexCostUsd(usage, model, this.priceOverride);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    // Codex CLI v0.130.0 headless flags (probed live, May 2026):
    //   codex exec --json -m <model> -C <cwd> -s workspace-write --skip-git-repo-check <prompt>
    // No `--` separator before prompt; prompt is the trailing positional. systemPrompt
    // is prepended to userMessage since `exec` accepts a single prompt argument.
    const prompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.userMessage}`
      : request.userMessage;
    const args = [
      'exec',
      '--json',
      '-m',
      request.model,
      '-C',
      request.workingDir,
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      prompt,
    ];

    const now = this.now;
    return spawnLineStream(this.binary, args, this.spawnFn, {
      parseLine: parseJsonLine,
      parseCtx: { runId: request.runId, now, onUnknown: this.onUnknown },
      // Codex doesn't emit a synthetic `done`; usage is emitted by the parser on
      // `turn.completed`, but we still seal the stream so consumers can rely on it.
      onClose: () => [{ kind: 'done', runId: request.runId, at: now() }],
    });
  }
}
