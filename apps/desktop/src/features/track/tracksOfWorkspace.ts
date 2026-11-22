import { storageFolderLastChange } from '../../store/slices/storage/classifyStorageFolder';
import type {
  StorageFolder,
  StorageFolderStatus,
  StorageFolderTerminals,
} from '../../store/slices/storage/types';

export type WorktreeVerdict = Exclude<StorageFolderStatus, 'in-use'>;

export type WorktreeTrack = Readonly<{
  folder: StorageFolder;
  verdict: WorktreeVerdict;
  lastChangeAt: number | null;
  liveTerminals: number;
}>;

export type ProjectWorktrees = Readonly<{
  tracks: ReadonlyArray<WorktreeTrack>;
  count: number;
  sizeBytes: number | null;
  safe: ReadonlyArray<WorktreeTrack>;
  safeBytes: number;
}>;

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly repoRoot: string;
  readonly terminals: StorageFolderTerminals;
};

type VerdictParams = {
  readonly folder: StorageFolder;
  readonly liveTerminals: number;
};

const trackVerdictOf = ({ folder, liveTerminals }: VerdictParams): WorktreeVerdict => {
  if (folder.facts === null) {
    return 'checking';
  }
  if (folder.facts.verdict === 'safe' && liveTerminals > 0) {
    return 'terminal-open';
  }
  return folder.facts.verdict;
};

type OrderParams = {
  readonly a: WorktreeTrack;
  readonly b: WorktreeTrack;
};

const byLiveThenRecent = ({ a, b }: OrderParams): number => {
  const live = Number(b.folder.origin === 'in-use') - Number(a.folder.origin === 'in-use');
  if (live !== 0) {
    return live;
  }
  return (b.lastChangeAt ?? 0) - (a.lastChangeAt ?? 0);
};

type BytesParams = {
  readonly tracks: ReadonlyArray<WorktreeTrack>;
};

const trackBytesOf = ({ tracks }: BytesParams): number =>
  tracks.reduce((sum, track) => sum + (track.folder.sizeBytes ?? 0), 0);

export const tracksOfWorkspace = ({ folders, repoRoot, terminals }: Params): ProjectWorktrees => {
  const tracks = folders
    .filter((folder) => folder.repoRoot === repoRoot)
    .map((folder) => {
      const liveTerminals = terminals.get(folder.path)?.length ?? 0;
      return {
        folder,
        verdict: trackVerdictOf({ folder, liveTerminals }),
        lastChangeAt: storageFolderLastChange({ folder }),
        liveTerminals,
      };
    })
    .sort((a, b) => byLiveThenRecent({ a, b }));
  const safe = tracks.filter((track) => track.verdict === 'safe');
  const isSized = tracks.some((track) => track.folder.sizeBytes !== null);
  return {
    tracks,
    count: tracks.length,
    sizeBytes: isSized ? trackBytesOf({ tracks }) : null,
    safe,
    safeBytes: trackBytesOf({ tracks: safe }),
  };
};
