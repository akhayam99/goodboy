import { useState } from 'react';
import { AlertTriangle, FolderX, Trash2 } from 'lucide-react';
import { Button, InlineConfirm, SectionSurface } from '@goodboy/ui';
import type { WorkspaceId, WorktreeRemovalMode, WorktreeRemovalReason } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { OrphanWorktree } from '../../worktree';
import { canForceRemoval, forceRemovalWarning, keptReasonLabel } from './reasonCopy';

const EMPTY: ReadonlyArray<never> = [];

type Props = {
  readonly workspaceId: WorkspaceId;
};

type KeptByPath = Readonly<Record<string, ReadonlyArray<WorktreeRemovalReason>>>;

type RunParams = {
  readonly paths: ReadonlyArray<string>;
  readonly mode: WorktreeRemovalMode;
};

const folderCount = ({ count }: { readonly count: number }): string =>
  `${count} ${count === 1 ? 'folder' : 'folders'}`;

const totalSize = ({ orphans }: { readonly orphans: ReadonlyArray<OrphanWorktree> }): string =>
  formatBytes({ bytes: orphans.reduce((sum, orphan) => sum + orphan.sizeBytes, 0) });

export const OrphanWorktreesSection = ({ workspaceId }: Props) => {
  const orphans = useAppStore((s) => s.orphanWorktrees[workspaceId] ?? EMPTY);
  const removeOrphanWorktrees = useAppStore((s) => s.removeOrphanWorktrees);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const [armed, setArmed] = useState<string | null>(null);
  const [kept, setKept] = useState<KeptByPath>({});

  if (orphans.length === 0) {
    return null;
  }

  const removable = orphans.filter((orphan) => kept[orphan.path] === undefined);
  const bulkLabel = folderCount({ count: removable.length });
  const bulkSize = totalSize({ orphans: removable });

  const run = async ({ paths, mode }: RunParams) => {
    try {
      const outcomes = await removeOrphanWorktrees({ workspaceId, paths, mode });
      const next: Record<string, ReadonlyArray<WorktreeRemovalReason>> = { ...kept };
      for (const outcome of outcomes) {
        delete next[outcome.path];
        if (outcome.kind === 'kept') {
          next[outcome.path] = outcome.reasons;
        }
      }
      setKept(next);
      const removedCount = outcomes.filter((outcome) => outcome.kind === 'removed').length;
      if (removedCount > 0) {
        showToast({ kind: 'success', message: `Removed ${folderCount({ count: removedCount })}.` });
      }
      const failures = outcomes.flatMap((outcome) =>
        outcome.kind === 'failed' ? [outcome.message] : [],
      );
      if (failures.length > 0) {
        void reportError({
          title: `Couldn't remove ${folderCount({ count: failures.length })}`,
          error: new Error(failures.join('\n')),
          workspaceId,
        });
      }
    } catch (error) {
      void reportError({
        title: `Couldn't remove ${folderCount({ count: paths.length })}`,
        error,
        workspaceId,
      });
    } finally {
      setArmed(null);
    }
  };

  return (
    <SectionSurface
      label="Session folders left on disk"
      hint="No session and no retained record claims these. A folder with changes not committed or commits not pushed stays until you remove it on its own. Branches stay."
      icon={<CONCEPT_ICONS.worktree size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col gap-1.5">
        {orphans.map((orphan) => {
          const reasons = kept[orphan.path];
          const size = formatBytes({ bytes: orphan.sizeBytes });
          const isArmed = armed === orphan.path;
          return (
            <div
              key={orphan.path}
              className="flex flex-col gap-1.5 rounded-md border border-border px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-xs text-foreground">{orphan.name}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {orphan.isRegistered
                      ? `${orphan.path} (still registered with git)`
                      : orphan.path}
                  </span>
                  {reasons === undefined ? null : (
                    <span className="flex items-center gap-1 text-2xs text-warning">
                      <AlertTriangle size={ICON_SIZE.row} aria-hidden />
                      {keptReasonLabel({ reasons })}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-2xs tabular-nums text-muted-foreground">{size}</span>
                  {reasons !== undefined && canForceRemoval({ reasons }) && !isArmed ? (
                    <Button variant="ghost" size="sm" onClick={() => setArmed(orphan.path)}>
                      Remove anyway
                    </Button>
                  ) : null}
                </div>
              </div>
              {reasons !== undefined && isArmed ? (
                <InlineConfirm
                  role="danger"
                  icon={<FolderX size={ICON_SIZE.row} aria-hidden />}
                  title={`Remove ${orphan.name} anyway?`}
                  description={forceRemovalWarning({ reasons, size })}
                  confirmLabel="Remove anyway"
                  onConfirm={() => run({ paths: [orphan.path], mode: 'confirmed' })}
                  onCancel={() => setArmed(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {removable.length > 0 && armed === 'bulk' && (
        <InlineConfirm
          role="danger"
          icon={<FolderX size={ICON_SIZE.row} aria-hidden />}
          title={`Remove ${bulkLabel}?`}
          description={`${bulkSize} will be removed from disk. Folders with changes not committed, commits not pushed, or that git doesn't track are kept. Branches stay.`}
          confirmLabel="Remove"
          onConfirm={() => run({ paths: removable.map((orphan) => orphan.path), mode: 'safe' })}
          onCancel={() => setArmed(null)}
        />
      )}
      {removable.length > 0 && armed !== 'bulk' && (
        <div className="flex justify-start">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setArmed('bulk')}
            className="text-danger hover:text-danger"
          >
            <Trash2 size={ICON_SIZE.row} aria-hidden />
            Remove {bulkLabel} ({bulkSize})
          </Button>
        </div>
      )}
    </SectionSurface>
  );
};
