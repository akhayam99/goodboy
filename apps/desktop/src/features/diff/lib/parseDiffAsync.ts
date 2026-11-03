import { parseUnifiedDiff } from '@goodboy/core/github';
import type { FileDiff } from '@goodboy/types';
import type { ParseDiffRequest, ParseDiffResponse } from './parseDiffProtocol';

type Params = {
  readonly raw: string;
};

type Parse = (params: Params) => Promise<ReadonlyArray<FileDiff>>;

type Waiting = {
  readonly resolve: (files: ReadonlyArray<FileDiff>) => void;
  readonly raw: string;
};

type SettleParams = {
  readonly entry: Waiting;
  readonly files: ReadonlyArray<FileDiff> | null;
};

const onMainThread: Parse = ({ raw }) => Promise.resolve(parseUnifiedDiff(raw));

const createWorkerParse = (): Parse | null => {
  if (typeof Worker !== 'function') {
    return null;
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./parseDiff.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let nextId = 0;
  let isBroken = false;
  const waiting = new Map<number, Waiting>();
  const settle = ({ entry, files }: SettleParams) => {
    entry.resolve(files ?? parseUnifiedDiff(entry.raw));
  };
  worker.onmessage = (event: MessageEvent<ParseDiffResponse>) => {
    const entry = waiting.get(event.data.id);
    waiting.delete(event.data.id);
    if (entry !== undefined) {
      settle({ entry, files: event.data.files });
    }
  };
  worker.onerror = () => {
    isBroken = true;
    worker.terminate();
    for (const entry of waiting.values()) {
      settle({ entry, files: null });
    }
    waiting.clear();
  };
  return ({ raw }) => {
    if (isBroken) {
      return onMainThread({ raw });
    }
    return new Promise((resolve) => {
      const id = nextId++;
      waiting.set(id, { resolve, raw });
      worker.postMessage({ id, raw } satisfies ParseDiffRequest);
    });
  };
};

let parse: Parse | null = null;

export const parseDiffAsync = ({ raw }: Params): Promise<ReadonlyArray<FileDiff>> => {
  parse ??= createWorkerParse() ?? onMainThread;
  return parse({ raw });
};
