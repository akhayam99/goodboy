import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { TurnEvent } from '@goodboy/types';
import type { ParseContext } from './anthropic-envelope-parser';

type ParseLine = (line: string, ctx: ParseContext) => ReadonlyArray<TurnEvent>;

type CloseParams = {
  readonly exitCode: number | null;
  readonly stderr: string;
};

type EndParams = {
  readonly exitCode: number | null;
  readonly source: 'child' | 'stdout';
};

type StreamChildEventsOptions = {
  readonly onClose?: ({ exitCode, stderr }: CloseParams) => ReadonlyArray<TurnEvent>;
};

const STDERR_TAIL_LENGTH = 8000;

export async function* streamChildEvents(
  child: ChildProcess,
  ctx: ParseContext,
  parseLine: ParseLine,
  options: StreamChildEventsOptions = {},
): AsyncIterable<TurnEvent> {
  const queue: TurnEvent[] = [];
  let resolver: ((value: IteratorResult<TurnEvent>) => void) | null = null;
  let rejector: ((err: unknown) => void) | null = null;
  let ended = false;
  let error: unknown = null;
  let stderr = '';
  let exitCode: number | null = null;
  let isStdoutClosed = false;
  let isChildClosed = false;

  const flush = () => {
    if (resolver != null && queue.length > 0) {
      const value = queue.shift()!;
      const r = resolver;
      resolver = null;
      rejector = null;
      r({ value, done: false });
      return;
    }
    if (resolver != null && ended) {
      const r = resolver;
      resolver = null;
      if (error != null) {
        const rej = rejector;
        rejector = null;
        rej?.(error);
        return;
      }
      r({ value: undefined, done: true });
    }
  };

  const endIfClosed = ({ exitCode: closedExitCode, source }: EndParams) => {
    if (source === 'stdout') {
      isStdoutClosed = true;
    }
    if (source === 'child') {
      exitCode = closedExitCode;
      isChildClosed = true;
    }
    if (!isStdoutClosed || !isChildClosed || ended) {
      return;
    }
    if (options.onClose != null) {
      for (const event of options.onClose({ exitCode, stderr })) queue.push(event);
    }
    ended = true;
    flush();
  };

  const lineReader = createInterface({ input: child.stdout! });

  lineReader.on('line', (line) => {
    const events = parseLine(line, ctx);
    for (const event of events) queue.push(event);
    flush();
  });

  lineReader.on('close', () => {
    endIfClosed({ exitCode: null, source: 'stdout' });
  });

  child.on('close', (code) => {
    endIfClosed({ exitCode: code, source: 'child' });
  });

  child.on('error', (err) => {
    error = err;
    ended = true;
    flush();
  });

  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    stderr = `${stderr}${text}`.slice(-STDERR_TAIL_LENGTH);
  });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (ended) {
        if (error != null) {
          throw error;
        }
        return;
      }
      const value = await new Promise<IteratorResult<TurnEvent>>((resolve, reject) => {
        resolver = resolve;
        rejector = reject;
      });
      if (value.done) {
        return;
      }
      yield value.value;
    }
  } finally {
    if (!child.killed && child.exitCode === null) {
      child.kill('SIGTERM');
    }
    lineReader.close();
  }
}
