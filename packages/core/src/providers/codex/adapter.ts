import { spawn, type ChildProcess } from 'node:child_process';
import type {
  DetectResult,
  IsoDateTime,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderUsage,
  TurnEvent,
  TurnRequest,
} from '@goodboy/types';
import { CODEX_DEFAULT_MODEL, CODEX_MODELS } from './constants';
import { computeCodexCostUsd, type CodexModelPriceOverride } from './cost';
import { parseJsonLine } from './parser';
import { streamChildEvents } from '../shared/stream-events';
import { resolveModelArgs } from '../resolveModelArgs';
import { resolveStoredModelSelection } from '../resolveStoredModelSelection';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 200_000,
  defaultModel: CODEX_DEFAULT_MODEL,
  availableModels: CODEX_MODELS.map((m) => m.id),
};

export type CodexAdapterDeps = {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
  readonly priceOverride?: CodexModelPriceOverride | null;
};

type SpawnParams = {
  readonly binary: string;
  readonly spawnFn: typeof spawn;
  readonly now: () => IsoDateTime;
  readonly onUnknown: (type: string, payload: unknown) => void;
  readonly request: TurnRequest;
};

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
    return new Promise((resolve) => {
      const child = this.spawnFn(this.binary, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        resolve({ kind: 'missing', binary: this.binary, reason: err.message });
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ kind: 'available', binary: this.binary, version: stdout.trim() });
        } else {
          resolve({
            kind: 'missing',
            binary: this.binary,
            reason: `exited with code ${code}`,
          });
        }
      });
    });
  }

  cost(usage: ProviderUsage, model: string): number {
    return computeCodexCostUsd(usage, model, this.priceOverride);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnCodex({
      binary: this.binary,
      spawnFn: this.spawnFn,
      now: this.now,
      onUnknown: this.onUnknown,
      request,
    });
  }
}

const spawnCodex = async function* ({
  binary,
  spawnFn,
  now,
  onUnknown,
  request,
}: SpawnParams): AsyncIterable<TurnEvent> {
  const prompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.userMessage}`
    : request.userMessage;
  const selection =
    request.selection ??
    resolveStoredModelSelection({
      provider: 'codex',
      id: request.model,
      ...(request.effort != null && { effort: request.effort }),
    }).selection;
  const modelArgs = resolveModelArgs({ provider: 'codex', selection }).args;
  const args = [
    'exec',
    '--json',
    ...modelArgs,
    '-C',
    request.workingDir,
    '-s',
    'workspace-write',
    '--skip-git-repo-check',
    prompt,
  ];

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('codex CLI started without stdout');
  }

  const ctx = { runId: request.runId, now, onUnknown };

  yield* streamChildEvents(child, ctx, parseJsonLine, {
    onClose: () => [{ kind: 'done', runId: request.runId, at: now() }],
  });
};
