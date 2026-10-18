import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { AppStore } from '../../../store/store';
import type { ChangeFile } from '../changeTurnsOf';
import type { FolderReadResult } from '../fileVersions';
import { textChangesOf, type TextChanges } from '../textChangesOf';

type ChangeSides =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; message: string }>
  | Readonly<{ status: 'text'; changes: TextChanges }>
  | Readonly<{ status: 'binary' }>
  | Readonly<{ status: 'tooLarge' }>
  | Readonly<{ status: 'unavailable' }>;

type Read = AppStore['readFolderVersion'];

type Params = Readonly<{
  sessionId: SessionId;
  file: ChangeFile | null;
}>;

type LoadParams = Readonly<{
  read: Read;
  sessionId: SessionId;
  file: ChangeFile;
}>;

type SettleParams = Readonly<{
  before: FolderReadResult | null;
  after: FolderReadResult | null;
}>;

type QueueParams = Readonly<{ task: () => Promise<void> }>;

const MAX_PARALLEL_READS = 3;
const MAX_CACHED_FILES = 120;
const LOADING: ChangeSides = { status: 'loading' };

const cache = new Map<string, Promise<ChangeSides>>();
const waiting: Array<() => void> = [];
let running = 0;

const enqueue = ({ task }: QueueParams): Promise<void> =>
  new Promise((resolve, reject) => {
    const start = () => {
      running += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          waiting.shift()?.();
        });
    };
    if (running < MAX_PARALLEL_READS) {
      start();
      return;
    }
    waiting.push(start);
  });

const settle = ({ before, after }: SettleParams): ChangeSides => {
  const sides = [before, after].filter((side): side is FolderReadResult => side !== null);
  if (sides.some((side) => side.kind === 'unavailable')) {
    return { status: 'unavailable' };
  }
  if (sides.some((side) => side.kind === 'tooLarge')) {
    return { status: 'tooLarge' };
  }
  if (sides.some((side) => side.kind === 'binary')) {
    return { status: 'binary' };
  }
  return {
    status: 'text',
    changes: textChangesOf({ before: before?.text ?? null, after: after?.text ?? null }),
  };
};

const load = ({ read, sessionId, file }: LoadParams): Promise<ChangeSides> => {
  const cached = cache.get(file.key);
  if (cached !== undefined) {
    cache.delete(file.key);
    cache.set(file.key, cached);
    return cached;
  }
  const target = { sessionId, folderPath: file.folderPath, runId: file.runId };
  let result: ChangeSides = LOADING;
  const pending = enqueue({
    task: async () => {
      const [before, after] = await Promise.all([
        file.change === 'added'
          ? Promise.resolve(null)
          : read({ ...target, relativePath: file.relativePath, side: 'before' }),
        file.change === 'deleted'
          ? Promise.resolve(null)
          : read({ ...target, relativePath: file.relativePath, side: 'after' }),
      ]);
      result = settle({ before, after });
    },
  }).then(
    () => result,
    (error: unknown) => {
      cache.delete(file.key);
      return { status: 'failed', message: formatError(error) } satisfies ChangeSides;
    },
  );
  cache.set(file.key, pending);
  while (cache.size > MAX_CACHED_FILES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
  return pending;
};

type Loaded = Readonly<{ key: string; attempt: number; sides: ChangeSides }>;

export type ChangeSidesView = Readonly<{
  sides: ChangeSides;
  retry: () => void;
}>;

export const useChangeSides = ({ sessionId, file }: Params): ChangeSidesView => {
  const read = useAppStore((state) => state.readFolderVersion);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = file?.key ?? null;

  useEffect(() => {
    if (file === null) {
      return;
    }
    let isCurrent = true;
    void load({ read, sessionId, file }).then((sides) => {
      if (isCurrent) {
        setLoaded({ key: file.key, attempt, sides });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [attempt, file, read, sessionId]);

  const isShown =
    key !== null && loaded !== null && loaded.key === key && loaded.attempt === attempt;
  return {
    sides: isShown ? loaded.sides : LOADING,
    retry: () => setAttempt((current) => current + 1),
  };
};
