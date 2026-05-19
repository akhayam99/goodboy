import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { DetectResult, TurnEvent } from '@kay-am/types';

/**
 * Runs `<binary> --version` and resolves to a [`DetectResult`]. The three
 * provider adapters used to ship identical copies of this block; centralising
 * it keeps every "is the CLI installed?" probe behaviourally consistent.
 */
export async function detectBinary(binary: string, spawnFn: typeof spawn): Promise<DetectResult> {
  return new Promise((resolve) => {
    const child = spawnFn(binary, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({ kind: 'missing', binary, reason: err.message });
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ kind: 'available', binary, version: stdout.trim() });
      } else {
        resolve({
          kind: 'missing',
          binary,
          reason: `exited with code ${code}`,
        });
      }
    });
  });
}

export interface LineStreamContext<TParseCtx> {
  /** Per-line parser. Must return zero or more [`TurnEvent`]s for the line. */
  readonly parseLine: (line: string, ctx: TParseCtx) => ReadonlyArray<TurnEvent>;
  /** Context value passed straight through to `parseLine`. */
  readonly parseCtx: TParseCtx;
  /**
   * Optional synthetic events to emit when the line reader closes. Codex uses
   * this to inject a `done` terminator; the other adapters leave this empty.
   */
  readonly onClose?: () => ReadonlyArray<TurnEvent>;
}

/**
 * Spawns a CLI, reads stdout line by line, runs each line through the
 * provider-specific parser, and yields the resulting events as an async
 * iterable. Stderr is captured but intentionally dropped — adapter authors
 * are expected to fold meaningful error context into their parser output.
 *
 * The child is reaped in the `finally` block: if the consumer stops iterating
 * early (e.g. caller threw), the process is sent SIGTERM and the readline
 * interface is closed. Without this, an abandoned codex/cursor run would
 * leak a zombie process.
 */
export async function* spawnLineStream<TParseCtx>(
  binary: string,
  args: ReadonlyArray<string>,
  spawnFn: typeof spawn,
  stream: LineStreamContext<TParseCtx>,
): AsyncIterable<TurnEvent> {
  const child: ChildProcess = spawnFn(binary, [...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!child.stdout) {
    throw new Error(`${binary} CLI started without stdout`);
  }

  const queue: TurnEvent[] = [];
  let resolver: ((value: IteratorResult<TurnEvent>) => void) | null = null;
  let rejector: ((err: unknown) => void) | null = null;
  let ended = false;
  let error: unknown = null;

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
    const events = stream.parseLine(line, stream.parseCtx);
    for (const event of events) queue.push(event);
    flush();
  });

  lineReader.on('close', () => {
    if (stream.onClose) {
      for (const event of stream.onClose()) queue.push(event);
    }
    ended = true;
    flush();
  });

  child.on('error', (err) => {
    error = err;
    ended = true;
    flush();
  });

  child.stderr?.on('data', () => {
    // captured but intentionally not surfaced as a TurnEvent
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
