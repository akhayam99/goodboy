import type {
  StorageStats,
  StorageFolder,
  StorageRoot,
  StorageSizeCache,
  StorageRemovalSummary,
  StorageFocus,
  StorageScope,
  StorageArtifact,
} from './types';
import type { OtherToolUsage } from '../../../features/storage/otherTools';

type StorageOtherTools = {
  readonly status: 'idle' | 'measuring' | 'ready' | 'failed';
  readonly tools: ReadonlyArray<OtherToolUsage>;
};

export type StorageState = {
  readonly storageStats: StorageStats | null;
  readonly storageStatsLoading: boolean;
  readonly storageFolders: ReadonlyArray<StorageFolder>;
  readonly storageRoots: ReadonlyArray<StorageRoot>;
  readonly storageSizeCache: StorageSizeCache;
  readonly storageMeasuringPath: string | null;
  readonly storageRemovingPaths: Readonly<Record<string, true>>;
  readonly storageOutcome: StorageRemovalSummary | null;
  readonly storageFocus: StorageFocus | null;
  readonly storageScope: StorageScope | null;
  readonly storageArtifacts: ReadonlyArray<StorageArtifact>;
  readonly storageDeletingArtifacts: Readonly<Record<string, true>>;
  readonly storageOtherTools: StorageOtherTools;
};

export const storageInitialState: StorageState = {
  storageStats: null,
  storageStatsLoading: false,
  storageFolders: [],
  storageRoots: [],
  storageSizeCache: {},
  storageMeasuringPath: null,
  storageRemovingPaths: {},
  storageOutcome: null,
  storageFocus: null,
  storageScope: null,
  storageArtifacts: [],
  storageDeletingArtifacts: {},
  storageOtherTools: { status: 'idle', tools: [] },
};
