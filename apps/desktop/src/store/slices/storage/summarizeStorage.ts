import { isStorageFolderSuggested, storageFolderBucket } from './classifyStorageFolder';
import type { StorageFolder, StorageFolderTerminals } from './types';

type StorageTally = {
  readonly count: number;
  readonly bytes: number;
};

export type StorageSummary = {
  readonly inUse: StorageTally;
  readonly canGo: StorageTally;
  readonly reviewFirst: StorageTally;
  readonly kept: StorageTally;
  readonly review: StorageTally;
  readonly unowned: number;
  readonly localCommitFolders: number;
};

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly now: number;
  readonly suggestAfterDays: number;
  readonly terminals: StorageFolderTerminals;
};

type AddParams = {
  readonly tally: StorageTally;
  readonly folder: StorageFolder;
};

const EMPTY: StorageTally = { count: 0, bytes: 0 };

const add = ({ tally, folder }: AddParams): StorageTally => ({
  count: tally.count + 1,
  bytes: tally.bytes + (folder.sizeBytes ?? 0),
});

export const summarizeStorage = ({
  folders,
  now,
  suggestAfterDays,
  terminals,
}: Params): StorageSummary => {
  let inUse = EMPTY;
  let canGo = EMPTY;
  let reviewFirst = EMPTY;
  let kept = EMPTY;
  let unowned = 0;
  let localCommitFolders = 0;
  for (const folder of folders) {
    const bucket = storageFolderBucket({ folder, now });
    if (bucket === 'in-use') {
      inUse = add({ tally: inUse, folder });
      continue;
    }
    if (folder.origin === 'ledger') {
      unowned += 1;
    }
    if (bucket === 'kept') {
      kept = add({ tally: kept, folder });
      continue;
    }
    const liveTerminals = terminals.get(folder.path)?.length ?? 0;
    if (isStorageFolderSuggested({ folder, now, suggestAfterDays, liveTerminals })) {
      canGo = add({ tally: canGo, folder });
      localCommitFolders += (folder.facts?.localOnlyCommits ?? 0) > 0 ? 1 : 0;
      continue;
    }
    reviewFirst = add({ tally: reviewFirst, folder });
  }
  return {
    inUse,
    canGo,
    reviewFirst,
    kept,
    review: { count: canGo.count + reviewFirst.count, bytes: canGo.bytes + reviewFirst.bytes },
    unowned,
    localCommitFolders,
  };
};
