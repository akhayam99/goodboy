import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { TurnEvent } from '@goodboy/types';
import type { ParseContext } from './anthropic-envelope-parser';

type ParseLine = (line: string, ctx: ParseContext) => ReadonlyArray<TurnEvent>;

type StreamChildEventsOptions = {
  readonly onClose?: () => ReadonlyArray<TurnEvent>;
};

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

  const lineReader = createInterface({ input: child.stdout! });

  lineReader.on('line', (line) => {
    const events = parseLine(line, ctx);
    for (const event of events) queue.push(event);
    flush();
  });

  lineReader.on('close', () => {
    if (options.onClose) {
      for (const event of options.onClose()) queue.push(event);
    }
    ended = true;
    flush();
  });

  child.on('error', (err) => {
    error = err;
    ended = true;
    flush();
  });

  child.stderr?.on('data', () => {});

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (ended) {
        if (error) {
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
