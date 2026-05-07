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
import { CODEX_CHEAP_MODEL } from './constants';
import { parseJsonLine } from './parser';

export { CODEX_CHEAP_MODEL };

const CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolUse: true,
  fileEdits: true,
  contextWindow: 128_000,
  defaultModel: 'codex-latest',
  availableModels: ['codex-latest', CODEX_CHEAP_MODEL],
};

export interface CodexAdapterDeps {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

export class CodexAdapter implements ProviderAdapter {
  readonly id = 'codex' as const;
  readonly capabilities = CAPABILITIES;

  private readonly binary: string;
  private readonly now: () => IsoDateTime;
  private readonly spawnFn: typeof spawn;
  private readonly onUnknown: (type: string, payload: unknown) => void;

  constructor(deps: CodexAdapterDeps = {}) {
    this.binary = deps.binary ?? 'codex';
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

  // Codex CLI does not report token counts; return zeros so cost is always 0.
  cost(_usage: ProviderUsage, _model: string): number {
    return 0;
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
  // Codex headless: `codex exec --json --model <model> --cwd <dir> -- <prompt>`
  // Assumption: codex CLI supports `exec` sub-command with --json for NDJSON output,
  // --model to select model, and --cwd to scope working directory.
  // systemPrompt is prepended to userMessage since codex exec takes a single prompt arg.
  const prompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.userMessage}`
    : request.userMessage;
  const args = [
    'exec',
    '--json',
    '--model',
    request.model,
    '--cwd',
    request.workingDir,
    '--',
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
    const at = now();
    // Emit zero usage + done on clean stream close.
    queue.push({
      kind: 'usage',
      runId: request.runId,
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0 },
      at,
    });
    queue.push({ kind: 'done', runId: request.runId, at });
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
