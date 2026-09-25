import type { StorageMountRow, StorageSessionRef } from '@goodboy/db';
import type { SessionId, WorktreeLedgerEntry } from '@goodboy/types';
import type { WorktreeFolderFacts } from '../../../features/worktree/worktree';
import type { KeptArchived } from './storageSettings';
import type { StorageFolder, StorageFolderWhy, StorageSizeCache } from './types';

type Params = {
  readonly mounts: ReadonlyArray<StorageMountRow>;
  readonly ledger: ReadonlyArray<WorktreeLedgerEntry>;
  readonly sessionRefs: ReadonlyArray<StorageSessionRef>;
  readonly keptArchived: KeptArchived;
  readonly sizes: StorageSizeCache;
  readonly facts: ReadonlyMap<string, WorktreeFolderFacts>;
};

type LedgerWhyParams = {
  readonly entry: WorktreeLedgerEntry;
  readonly ref: StorageSessionRef | undefined;
};

const ledgerWhy = ({ entry, ref }: LedgerWhyParams): StorageFolderWhy => {
  if (entry.sourceSessionId === null || ref === undefined) {
    return 'no-session';
  }
  if (ref.deletedAt !== null) {
    return 'deleted-session';
  }
  if (ref.archivedAt !== null) {
    return 'archived-session';
  }
  return 'kept-by-goodboy';
};

const toMs = (value: string | null): number | null => (value === null ? null : Date.parse(value));

export const buildStorageFolders = ({
  mounts,
  ledger,
  sessionRefs,
  keptArchived,
  sizes,
  facts,
}: Params): ReadonlyArray<StorageFolder> => {
  const refs = new Map<SessionId, StorageSessionRef>(
    sessionRefs.map((ref) => [ref.sessionId, ref]),
  );
  const seen = new Set<string>();
  const folders: Array<StorageFolder> = [];
  for (const mount of mounts) {
    if (mount.repoRoot === null || seen.has(mount.worktreePath)) {
      continue;
    }
    seen.add(mount.worktreePath);
    const isArchived = mount.archivedAt !== null;
    const kept = isArchived ? keptArchived[mount.worktreePath] : undefined;
    const cached = sizes[mount.worktreePath];
    folders.push({
      path: mount.worktreePath,
      repoRoot: mount.repoRoot,
      branch: mount.branch,
      origin: isArchived ? 'archived' : 'in-use',
      why: isArchived ? 'archived-session' : 'active-session',
      sessionId: mount.sessionId,
      sessionGoal: mount.sessionGoal,
      mountId: mount.mountId,
      revision: mount.revision,
      ledgerId: null,
      workspaceId: mount.workspaceId,
      sessionActivityAt: mount.lastActivityAt,
      sizeBytes: cached?.sizeBytes ?? null,
      sizedAt: cached?.sizedAt ?? null,
      facts: facts.get(mount.worktreePath) ?? null,
      keptAt: kept?.keptAt ?? null,
      keptUntil: kept?.keptUntil ?? null,
    });
  }
  for (const entry of ledger) {
    if (entry.repoRoot === '' || seen.has(entry.worktreePath)) {
      continue;
    }
    seen.add(entry.worktreePath);
    const ref = entry.sourceSessionId === null ? undefined : refs.get(entry.sourceSessionId);
    const fact = facts.get(entry.worktreePath) ?? null;
    const cached = sizes[entry.worktreePath];
    const sizedAt = toMs(entry.sizedAt);
    const isCacheNewer = cached !== undefined && (sizedAt === null || cached.sizedAt > sizedAt);
    folders.push({
      path: entry.worktreePath,
      repoRoot: entry.repoRoot,
      branch: entry.branch !== '' ? entry.branch : (fact?.branch ?? ''),
      origin: 'ledger',
      why: ledgerWhy({ entry, ref }),
      sessionId: entry.sourceSessionId,
      sessionGoal: ref?.goal ?? null,
      mountId: entry.sourceMountId,
      revision: null,
      ledgerId: entry.id,
      workspaceId: entry.workspaceId,
      sessionActivityAt: ref?.lastActivityAt ?? null,
      sizeBytes: isCacheNewer ? cached.sizeBytes : entry.sizeBytes,
      sizedAt: isCacheNewer ? cached.sizedAt : sizedAt,
      facts: fact,
      keptAt: toMs(entry.keptAt),
      keptUntil: toMs(entry.keptUntil),
    });
  }
  return folders.filter((folder) => folder.facts === null || folder.facts.exists);
};
