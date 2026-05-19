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
import { computeCostUsd } from './cost';
import { parseStreamJsonLine } from './parser';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 1_000_000,
  defaultModel: 'claude-opus-4-7',
  availableModels: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
};

export interface ClaudeAdapterDeps {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

export class ClaudeAdapter implements ProviderAdapter {
  readonly id = 'anthropic' as const;
  readonly capabilities = CAPABILITIES;

  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;

  constructor(deps: ClaudeAdapterDeps = {}) {
    this.binary = deps.binary ?? 'claude';
    this.now = deps.now ?? (() => new Date().toISOString() as IsoDateTime);
    this.spawnFn = deps.spawnFn ?? spawn;
    this.onUnknown = deps.onUnknown ?? (() => undefined);
  }

  async detect(): Promise<DetectResult> {
    return detectBinary(this.binary, this.spawnFn);
  }

  cost(usage: ProviderUsage, model: string): number {
    return computeCostUsd(usage, model);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    const prompt = `${request.systemPrompt}\n\n${request.userMessage}`.trim();
    const flags = request.permissionFlags;
    const mode = flags?.mode ?? 'default';

    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--working-dir',
      request.workingDir,
      '--model',
      request.model,
      '--permission-mode',
      mode,
    ];

    const allowedTools = flags?.allowedTools ?? [];
    const disallowedTools = flags?.disallowedTools ?? [];

    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (disallowedTools.length > 0) {
      args.push('--disallowedTools', disallowedTools.join(','));
    }

    return spawnLineStream(this.binary, args, this.spawnFn, {
      parseLine: parseStreamJsonLine,
      parseCtx: { runId: request.runId, now: this.now, onUnknown: this.onUnknown },
    });
  }
}
