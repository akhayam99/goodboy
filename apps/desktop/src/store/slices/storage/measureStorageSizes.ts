import { setWorktreeLedgerSize } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { worktreeDirectorySize } from '../../../features/worktree/worktree';
import { STORAGE_DAY_MS } from './classifyStorageFolder';
import type { GetFn, MeasureStorageSizesParams, SetFn, StorageFolder } from './types';

type MeasureRequest = {
  readonly isAll: boolean;
  readonly isForced: boolean;
  readonly paths: ReadonlySet<string>;
};

let isRunning = false;
let queued: MeasureRequest | null = null;

type StaleParams = {
  readonly folder: StorageFolder;
  readonly now: number;
  readonly request: MeasureRequest;
};

const needsMeasure = ({ folder, now, request }: StaleParams): boolean => {
  if (request.paths.has(folder.path)) {
    return true;
  }
  if (!request.isAll) {
    return false;
  }
  return request.isForced || folder.sizedAt === null || now - folder.sizedAt > STORAGE_DAY_MS;
};

const inUseLast = (a: StorageFolder, b: StorageFolder): number =>
  Number(a.origin === 'in-use') - Number(b.origin === 'in-use');

type MergeParams = {
  readonly current: MeasureRequest | null;
  readonly next: MeasureRequest;
};

const mergeRequests = ({ current, next }: MergeParams): MeasureRequest => {
  if (current === null) {
    return next;
  }
  return {
    isAll: current.isAll || next.isAll,
    isForced: (current.isAll && current.isForced) || (next.isAll && next.isForced),
    paths: new Set<string>([...current.paths, ...next.paths]),
  };
};

type RecordParams = {
  readonly set: SetFn;
  readonly folder: StorageFolder;
  readonly sizeBytes: number;
  readonly sizedAt: number;
};

const recordSize = async ({ set, folder, sizeBytes, sizedAt }: RecordParams): Promise<void> => {
  set((state) => ({
    storageSizeCache: { ...state.storageSizeCache, [folder.path]: { sizeBytes, sizedAt } },
    storageFolders: state.storageFolders.map((candidate) =>
      candidate.path === folder.path ? { ...candidate, sizeBytes, sizedAt } : candidate,
    ),
  }));
  if (folder.origin !== 'ledger') {
    return;
  }
  await setWorktreeLedgerSize({
    db: tauriDatabase,
    worktreePath: folder.path,
    sizeBytes,
    sizedAt: new Date(sizedAt).toISOString() as IsoDateTime,
  }).catch(() => undefined);
};

type RunParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly request: MeasureRequest;
};

const runMeasure = async ({ set, get, request }: RunParams): Promise<void> => {
  const now = Date.now();
  const targets = get()
    .storageFolders.filter((folder) => needsMeasure({ folder, now, request }))
    .sort(inUseLast);
  for (const target of targets) {
    const current = get().storageFolders.find((folder) => folder.path === target.path);
    if (current === undefined) {
      continue;
    }
    set({ storageMeasuringPath: target.path });
    const size = await worktreeDirectorySize({ path: target.path }).catch(() => null);
    if (size !== null && size.sizeBytes !== null) {
      await recordSize({ set, folder: current, sizeBytes: size.sizeBytes, sizedAt: Date.now() });
    }
  }
  set({ storageMeasuringPath: null });
  await get()
    .checkStorageNudge()
    .catch(() => undefined);
};

type QueueParams = {
  readonly request: MeasureRequest;
};

export const measureStorageSizes = (set: SetFn, get: GetFn) => {
  const run = async ({ request }: QueueParams): Promise<void> => {
    if (isRunning) {
      queued = mergeRequests({ current: queued, next: request });
      return;
    }
    isRunning = true;
    try {
      await runMeasure({ set, get, request });
    } finally {
      isRunning = false;
    }
    if (queued !== null) {
      const next = queued;
      queued = null;
      await run({ request: next });
    }
  };
  return async ({ isForced = false, paths }: MeasureStorageSizesParams = {}): Promise<void> =>
    run({
      request: { isAll: paths === undefined, isForced, paths: new Set<string>(paths ?? []) },
    });
};
