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
import { OPENCODE_DEFAULT_MODEL, OPENCODE_MODELS } from './constants';
import { computeOpenCodeCostUsd, type OpenCodeModelPriceOverride } from './cost';
import { parseJsonLine } from './parser';
import { streamChildEvents } from '../shared/stream-events';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 200_000,
  defaultModel: OPENCODE_DEFAULT_MODEL,
  availableModels: OPENCODE_MODELS.map((m) => m.id),
};

export type OpenCodeAdapterDeps = {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
  readonly priceOverride?: OpenCodeModelPriceOverride | null;
};

export class OpenCodeAdapter implements ProviderAdapter {
  readonly id = 'opencode' as const;
  readonly capabilities = CAPABILITIES;

  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;
  private readonly priceOverride: OpenCodeModelPriceOverride | null;

  constructor(deps: OpenCodeAdapterDeps = {}) {
    this.binary = deps.binary ?? 'opencode';
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
    return computeOpenCodeCostUsd(usage, model, this.priceOverride);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnOpenCode(this.binary, this.spawnFn, this.now, this.onUnknown, request);
  }
}

async function* spawnOpenCode(
  binary: string,
  spawnFn: typeof spawn,
  now: () => IsoDateTime,
  onUnknown: (type: string, payload: unknown) => void,
  request: TurnRequest,
): AsyncIterable<TurnEvent> {
  const prompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.userMessage}`
    : request.userMessage;
  const args = ['run', '--prompt', prompt, '--model', request.model, '--cwd', request.workingDir];

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('opencode CLI started without stdout');
  }

  const ctx = { runId: request.runId, now, onUnknown };

  yield* streamChildEvents(child, ctx, parseJsonLine, {
    onClose: () => [{ kind: 'done', runId: request.runId, at: now() }],
  });
}
