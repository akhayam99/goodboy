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
import { computeCostUsd } from './cost';
import { parseStreamJsonLine } from './parser';
import { streamChildEvents } from '../shared/stream-events';
import { resolveModelArgs } from '../resolveModelArgs';
import { resolveStoredModelSelection } from '../resolveStoredModelSelection';
import { ANTHROPIC_CATALOG } from './catalog';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  defaultModel: ANTHROPIC_CATALOG[0]?.key ?? '',
  availableModels: ANTHROPIC_CATALOG.map((model) => model.key),
};

export type ClaudeAdapterDeps = {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

type SpawnParams = {
  readonly binary: string;
  readonly spawnFn: typeof spawn;
  readonly now: () => IsoDateTime;
  readonly onUnknown: (type: string, payload: unknown) => void;
  readonly request: TurnRequest;
};

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
    return new Promise((resolve) => {
      const child = this.spawnFn(this.binary, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        resolve({
          kind: 'missing',
          binary: this.binary,
          reason: err.message,
        });
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            kind: 'available',
            binary: this.binary,
            version: stdout.trim(),
          });
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
    return computeCostUsd({ usage, model });
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnClaude({
      binary: this.binary,
      spawnFn: this.spawnFn,
      now: this.now,
      onUnknown: this.onUnknown,
      request,
    });
  }
}

const spawnClaude = async function* ({
  binary,
  spawnFn,
  now,
  onUnknown,
  request,
}: SpawnParams): AsyncIterable<TurnEvent> {
  const prompt = `${request.systemPrompt}\n\n${request.userMessage}`.trim();
  const flags = request.permissionFlags;
  const mode = flags?.mode ?? 'default';
  const selection =
    request.selection ??
    resolveStoredModelSelection({
      provider: 'anthropic',
      id: request.model,
      ...(request.effort != null && { effort: request.effort }),
    }).selection;
  const modelArgs = resolveModelArgs({ provider: 'anthropic', selection }).args;

  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--working-dir',
    request.workingDir,
    ...modelArgs,
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

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('claude CLI started without stdout');
  }

  const ctx = { runId: request.runId, now, onUnknown };

  yield* streamChildEvents(child, ctx, parseStreamJsonLine);
};
