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
import { computeCursorCostUsd } from './cost';
import { CURSOR_DEFAULT_MODEL, CURSOR_MODELS } from './models';
import { parseCursorStreamLine } from './parser';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 200_000,
  defaultModel: CURSOR_DEFAULT_MODEL,
  availableModels: CURSOR_MODELS.map((m) => m.id),
};

export interface CursorAdapterDeps {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

export class CursorAdapter implements ProviderAdapter {
  readonly id = 'cursor' as const;
  readonly capabilities = CAPABILITIES;

  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;

  constructor(deps: CursorAdapterDeps = {}) {
    this.binary = deps.binary ?? 'cursor-agent';
    this.now = deps.now ?? (() => new Date().toISOString() as IsoDateTime);
    this.spawnFn = deps.spawnFn ?? spawn;
    this.onUnknown = deps.onUnknown ?? (() => undefined);
  }

  async detect(): Promise<DetectResult> {
    return detectBinary(this.binary, this.spawnFn);
  }

  cost(usage: ProviderUsage, model: string): number {
    return computeCursorCostUsd(usage, model);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    const prompt = `${request.systemPrompt}\n\n${request.userMessage}`.trim();
    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--workspace',
      request.workingDir,
      '--model',
      request.model,
      // --force is the cursor-agent equivalent of --dangerously-skip-permissions:
      // allows all tool/command execution without interactive confirmation prompts.
      '--force',
    ];

    return spawnLineStream(this.binary, args, this.spawnFn, {
      parseLine: parseCursorStreamLine,
      parseCtx: { runId: request.runId, now: this.now, onUnknown: this.onUnknown },
    });
  }
}
