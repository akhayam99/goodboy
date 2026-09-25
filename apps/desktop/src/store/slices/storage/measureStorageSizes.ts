import { setWorktreeLedgerSize } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { worktreeDirectorySize } from '../../../features/worktree/worktree';
import { STORAGE_DAY_MS } from './classifyStorageFolder';
import type { GetFn, SetFn, StorageFolder } from './types';

type MeasureParams = {
  readonly isForced?: boolean;
};

let isRunning = false;
let isQueuedForced: boolean | null = null;

type StaleParams = {
  readonly folder: StorageFolder;
  readonly now: number;
  readonly isForced: boolean;
};

const needsMeasure = ({ folder, now, isForced }: StaleParams): boolean =>
  isForced || folder.sizedAt === null || now - folder.sizedAt > STORAGE_DAY_MS;

const inUseLast = (a: StorageFolder, b: StorageFolder): number =>
  Number(a.origin === 'in-use') - Number(b.origin === 'in-use');

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
  readonly isForced: boolean;
};

const runMeasure = async ({ set, get, isForced }: RunParams): Promise<void> => {
  const now = Date.now();
  const targets = get()
    .storageFolders.filter((folder) => needsMeasure({ folder, now, isForced }))
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
};

export const measureStorageSizes = (set: SetFn, get: GetFn) => {
  const measure = async ({ isForced = false }: MeasureParams = {}): Promise<void> => {
    if (isRunning) {
      isQueuedForced = (isQueuedForced ?? false) || isForced;
      return;
    }
    isRunning = true;
    try {
      await runMeasure({ set, get, isForced });
    } finally {
      isRunning = false;
    }
    if (isQueuedForced !== null) {
      const queued = isQueuedForced;
      isQueuedForced = null;
      await measure({ isForced: queued });
    }
  };
  return measure;
};
