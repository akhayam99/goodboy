import { spawn, type ChildProcess } from 'node:child_process';
import type {
  DetectResult,
  IsoDateTime,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderId,
  ProviderName,
  ProviderUsage,
  TurnEvent,
  TurnRequest,
} from '@goodboy/types';
import { streamChildEvents } from '../shared/stream-events';
import { OPENROUTER_MODELS } from '../openrouter/constants';
import { OPENCODE_MODELS } from './constants';
import { computeOpenCodeCostUsd } from './cost';
import { parseJsonLine, resetOpenCodeParseState } from './parser';
import { resolveModelArgs } from '../resolveModelArgs';
import { resolveStoredModelSelection } from '../resolveStoredModelSelection';

type OpenCodeProviderId = Extract<ProviderId, 'opencode' | 'openrouter'>;

export type OpenCodeAdapterDeps = {
  readonly providerId?: OpenCodeProviderId;
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
  readonly providerId: OpenCodeProviderId;
  readonly request: TurnRequest;
};

type ProviderParams = {
  readonly providerId: OpenCodeProviderId;
};

const modelsFor = ({ providerId }: ProviderParams) => {
  return providerId === 'openrouter' ? OPENROUTER_MODELS : OPENCODE_MODELS;
};

const capabilitiesFor = ({ providerId }: ProviderParams): ProviderCapabilities => {
  const models = modelsFor({ providerId });
  return {
    streaming: true,
    toolUse: true,
    fileEdits: true,
    defaultModel: models.find((model) => model.tier === 'turn')?.id ?? models[0]?.id ?? '',
    availableModels: models.map((model) => model.id),
  };
};

export class OpenCodeAdapter implements ProviderAdapter {
  readonly id: ProviderName;
  readonly capabilities: ProviderCapabilities;

  private readonly providerId: OpenCodeProviderId;
  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;

  constructor(deps: OpenCodeAdapterDeps = {}) {
    this.providerId = deps.providerId ?? 'opencode';
    this.id = this.providerId;
    this.capabilities = capabilitiesFor({ providerId: this.providerId });
    this.binary = deps.binary ?? 'opencode';
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
      child.on('error', (error) => {
        resolve({ kind: 'missing', binary: this.binary, reason: error.message });
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ kind: 'available', binary: this.binary, version: stdout.trim() });
          return;
        }
        resolve({
          kind: 'missing',
          binary: this.binary,
          reason: `exited with code ${code}`,
        });
      });
    });
  }

  cost(usage: ProviderUsage, model: string): number {
    return computeOpenCodeCostUsd({ usage, model });
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnOpenCode({
      binary: this.binary,
      spawnFn: this.spawnFn,
      now: this.now,
      onUnknown: this.onUnknown,
      providerId: this.providerId,
      request,
    });
  }
}

const spawnOpenCode = async function* ({
  binary,
  spawnFn,
  now,
  onUnknown,
  providerId,
  request,
}: SpawnParams): AsyncIterable<TurnEvent> {
  const prompt =
    request.systemPrompt.length > 0
      ? `${request.systemPrompt}\n\n${request.userMessage}`
      : request.userMessage;
  const selection =
    request.selection ??
    resolveStoredModelSelection({
      provider: providerId,
      id: request.model,
      ...(request.effort != null && { effort: request.effort }),
    }).selection;
  const modelArgs = resolveModelArgs({ provider: providerId, selection }).args;
  const args = [
    'run',
    '--format',
    'json',
    ...modelArgs,
    '--dir',
    request.workingDir,
    '--dangerously-skip-permissions',
    prompt,
  ];
  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (child.stdout === null) {
    throw new Error('opencode CLI started without stdout');
  }
  const ctx = { runId: request.runId, now, onUnknown };
  yield* streamChildEvents(child, ctx, (line, parseCtx) => parseJsonLine({ line, ctx: parseCtx }), {
    onClose: () => {
      resetOpenCodeParseState({ runId: request.runId });
      return [{ kind: 'done', runId: request.runId, at: now() }];
    },
  });
};
