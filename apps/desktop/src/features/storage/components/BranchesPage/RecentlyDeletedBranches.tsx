import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DeletedBranch } from '@goodboy/types';
import { DELETED_BRANCH_KEEP_DAYS } from '@goodboy/types';
import { Band, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useToast } from '../../../../shared/components/Toast';
import { useNow } from '../../../../shared/hooks/useNow';
import type { BranchScope } from '../../branches/branchScopeOf';
import { useRecentlyDeletedBranches } from '../../useRecentlyDeletedBranches';
import { DeletedBranchRow } from './DeletedBranchRow';

type Props = {
  readonly scope: BranchScope;
};

export const RecentlyDeletedBranches = ({ scope }: Props) => {
  const entries = useRecentlyDeletedBranches({ scope });
  const projects = useAppStore((state) => state.projects);
  const restoreDeletedBranches = useAppStore((state) => state.restoreDeletedBranches);
  const forgetDeletedBranches = useAppStore((state) => state.forgetDeletedBranches);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const now = useNow(60_000);
  const bodyId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const projectNameOf = (entry: DeletedBranch): string =>
    projectById(projects, entry.projectId)?.name ?? 'a removed project';

  const restore = async (entry: DeletedBranch) => {
    setBusyId(entry.id);
    try {
      await restoreDeletedBranches({ ids: [entry.id] });
      showToast({
        kind: 'success',
        message: `Restored ${entry.branch} to ${projectNameOf(entry)}.`,
      });
    } catch (error) {
      void reportError({ title: "Couldn't restore the branch", error });
    } finally {
      setBusyId(null);
    }
  };

  const forget = async (entry: DeletedBranch) => {
    setBusyId(entry.id);
    try {
      await forgetDeletedBranches({ ids: [entry.id] });
      setConfirmId(null);
      showToast({ kind: 'success', message: `Deleted ${entry.branch} permanently.` });
    } catch (error) {
      void reportError({ title: "Couldn't delete the branch", error });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Recently deleted" className="flex flex-col">
      <Band>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen(!isOpen)}
          className="flex min-h-9 items-center gap-2 rounded-sm px-2 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'shrink-0 text-faint-foreground motion-safe:transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          <span className="text-row text-foreground">Recently deleted</span>
          <span className="text-meta tabular-nums text-muted-foreground">{entries.length}</span>
          <span className="text-meta text-faint-foreground">
            Restorable for {DELETED_BRANCH_KEEP_DAYS} days
          </span>
        </button>
        {isOpen ? (
          <div id={bodyId} className="flex flex-col gap-1 pb-1">
            {entries.length === 0 ? (
              <p className="px-2 py-2 text-label text-muted-foreground">
                Nothing deleted in the last {DELETED_BRANCH_KEEP_DAYS} days.
              </p>
            ) : (
              <ul className="flex flex-col">
                {entries.map((entry) => (
                  <DeletedBranchRow
                    key={entry.id}
                    entry={entry}
                    projectName={projectNameOf(entry)}
                    now={now}
                    isBusy={busyId === entry.id}
                    isConfirming={confirmId === entry.id}
                    onRestore={() => void restore(entry)}
                    onArmForget={() => setConfirmId(entry.id)}
                    onForget={() => forget(entry)}
                    onCancel={() => setConfirmId(null)}
                  />
                ))}
              </ul>
            )}
            <p className="px-2 text-meta text-faint-foreground">
              Expired ones are released when you open this page.
            </p>
          </div>
        ) : null}
      </Band>
    </section>
  );
};
