import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
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

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 1_000_000,
  defaultModel: 'claude-opus-4-8',
  availableModels: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
};

export type ClaudeAdapterDeps = {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
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
    return computeCostUsd(usage, model);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnClaude(this.binary, this.spawnFn, this.now, this.onUnknown, request);
  }
}

async function* spawnClaude(
  binary: string,
  spawnFn: typeof spawn,
  now: () => IsoDateTime,
  onUnknown: (type: string, payload: unknown) => void,
  request: TurnRequest,
): AsyncIterable<TurnEvent> {
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

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('claude CLI started without stdout');
  }

  const queue: TurnEvent[] = [];
  let resolver: ((value: IteratorResult<TurnEvent>) => void) | null = null;
  let rejector: ((err: unknown) => void) | null = null;
  let ended = false;
  let error: unknown = null;

  const ctx = { runId: request.runId, now, onUnknown };

  const flush = () => {
    if (resolver && queue.length > 0) {
      const value = queue.shift()!;
      const r = resolver;
      resolver = null;
      r({ value, done: false });
    } else if (resolver && ended) {
      const r = resolver;
      resolver = null;
      if (error) {
        const rej = rejector;
        rejector = null;
        rej?.(error);
      } else {
        r({ value: undefined, done: true });
      }
    }
  };

  const lineReader = createInterface({ input: child.stdout });

  lineReader.on('line', (line) => {
    const events = parseStreamJsonLine(line, ctx);
    for (const event of events) queue.push(event);
    flush();
  });

  lineReader.on('close', () => {
    ended = true;
    flush();
  });

  child.on('error', (err) => {
    error = err;
    ended = true;
    flush();
  });

  child.stderr?.on('data', () => {
    // captured but not surfaced as TurnEvent for v0.0.1
  });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (ended) {
        if (error) throw error;
        return;
      }
      const value = await new Promise<IteratorResult<TurnEvent>>((resolve, reject) => {
        resolver = resolve;
        rejector = reject;
      });
      if (value.done) return;
      yield value.value;
    }
  } finally {
    if (!child.killed && child.exitCode === null) {
      child.kill('SIGTERM');
    }
    lineReader.close();
  }
}
