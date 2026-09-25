import { deleteWorktreeLedgerEntries, recordOrphanWorktrees } from '@goodboy/db';
import type { IsoDateTime, ProjectId, WorkspaceId, WorktreeLedgerEntry } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { worktreeFolderFacts, type OrphanWorktree } from '../../../features/worktree/worktree';

type LedgerOwner = {
  readonly workspaceId: WorkspaceId | null;
  readonly projectId: ProjectId | null;
};

type Params = {
  readonly repoRoot: string;
  readonly owner: LedgerOwner;
  readonly orphans: ReadonlyArray<OrphanWorktree>;
  readonly ledger: ReadonlyArray<WorktreeLedgerEntry>;
  readonly now: IsoDateTime;
};

const isUnowned = (entry: WorktreeLedgerEntry): boolean =>
  entry.reason === 'orphan' || entry.workspaceId === null || entry.sourceSessionId === null;

type BranchesParams = {
  readonly repoRoot: string;
  readonly paths: ReadonlyArray<string>;
};

const branchesOf = async ({
  repoRoot,
  paths,
}: BranchesParams): Promise<ReadonlyMap<string, string>> => {
  const facts = await worktreeFolderFacts({
    requests: paths.map((path) => ({ repoRoot, path })),
  }).catch(() => []);
  return new Map(facts.map((fact) => [fact.path, fact.branch ?? '']));
};

export const syncOrphanLedger = async ({
  repoRoot,
  owner,
  orphans,
  ledger,
  now,
}: Params): Promise<void> => {
  const seen = new Set(orphans.map((orphan) => orphan.path));
  const stale = ledger
    .filter((entry) => entry.repoRoot === repoRoot && isUnowned(entry))
    .filter((entry) => !seen.has(entry.worktreePath))
    .map((entry) => entry.id);
  await deleteWorktreeLedgerEntries({ db: tauriDatabase, ids: stale }).catch(() => undefined);
  const recorded = new Set(ledger.map((entry) => entry.worktreePath));
  const fresh = orphans.filter((orphan) => !recorded.has(orphan.path));
  const branches = await branchesOf({ repoRoot, paths: fresh.map((orphan) => orphan.path) });
  await recordOrphanWorktrees({
    db: tauriDatabase,
    seenAt: now,
    orphans: orphans.map((orphan) => ({
      repoRoot,
      worktreePath: orphan.path,
      branch: branches.get(orphan.path) ?? '',
      workspaceId: owner.workspaceId,
      projectId: owner.projectId,
      sizeBytes: null,
    })),
  }).catch(() => undefined);
};
