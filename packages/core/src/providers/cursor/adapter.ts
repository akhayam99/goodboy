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
import { computeCursorCostUsd } from './cost';
import { CURSOR_DEFAULT_MODEL, CURSOR_MODELS } from './models';
import { parseCursorStreamLine } from './parser';
import { streamChildEvents } from '../shared/stream-events';
import { resolveModelArgs } from '../resolveModelArgs';
import { resolveStoredModelSelection } from '../resolveStoredModelSelection';

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 200_000,
  defaultModel: CURSOR_DEFAULT_MODEL,
  availableModels: CURSOR_MODELS.map((m) => m.id),
};

export type CursorAdapterDeps = {
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
    return computeCursorCostUsd(usage, model);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnCursor({
      binary: this.binary,
      spawnFn: this.spawnFn,
      now: this.now,
      onUnknown: this.onUnknown,
      request,
    });
  }
}

const spawnCursor = async function* ({
  binary,
  spawnFn,
  now,
  onUnknown,
  request,
}: SpawnParams): AsyncIterable<TurnEvent> {
  const prompt = `${request.systemPrompt}\n\n${request.userMessage}`.trim();
  const selection =
    request.selection ??
    resolveStoredModelSelection({
      provider: 'cursor',
      id: request.model,
      ...(request.effort != null && { effort: request.effort }),
    }).selection;
  const modelArgs = resolveModelArgs({ provider: 'cursor', selection }).args;
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--workspace',
    request.workingDir,
    ...modelArgs,
    '--force',
  ];

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('cursor-agent CLI started without stdout');
  }

  const ctx = { runId: request.runId, now, onUnknown };

  yield* streamChildEvents(child, ctx, parseCursorStreamLine);
};
