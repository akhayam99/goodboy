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
} from '@kay-am/types';
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

  // ChatGPT-login users are unmetered; API-key users can wire a price override
  // via CodexAdapterDeps.priceOverride to surface estimated USD.
  cost(usage: ProviderUsage, model: string): number {
    return computeCodexCostUsd(usage, model, this.priceOverride);
  }

  spawn(request: TurnRequest): AsyncIterable<TurnEvent> {
    return spawnCodex(this.binary, this.spawnFn, this.now, this.onUnknown, request);
  }
}

async function* spawnCodex(
  binary: string,
  spawnFn: typeof spawn,
  now: () => IsoDateTime,
  onUnknown: (type: string, payload: unknown) => void,
  request: TurnRequest,
): AsyncIterable<TurnEvent> {
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

  const child: ChildProcess = spawnFn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error('codex CLI started without stdout');
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
    const events = parseJsonLine(line, ctx);
    for (const event of events) queue.push(event);
    flush();
  });

  lineReader.on('close', () => {
    // Usage is emitted by the parser on `turn.completed`. We only need to seal
    // the stream with `done` here.
    queue.push({ kind: 'done', runId: request.runId, at: now() });
    ended = true;
    flush();
  });

  child.on('error', (err) => {
    error = err;
    ended = true;
    flush();
  });

  child.stderr?.on('data', () => {
    // captured but not surfaced as TurnEvent for v0.1
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
