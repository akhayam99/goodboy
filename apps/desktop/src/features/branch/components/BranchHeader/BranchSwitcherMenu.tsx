import { Plus } from 'lucide-react';
import type { CrumbMenuGroup, CrumbMenuRow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchSwitcherRow } from './BranchSwitcherRow';

type Props = {
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly count: number;
  readonly canCreate: boolean;
  readonly onChoose: (row: CrumbMenuRow) => void;
  readonly onNewBranch: () => void;
};

export const BranchSwitcherMenu = ({ groups, count, canCreate, onChoose, onNewBranch }: Props) => {
  const hasRows = count > 1;
  const isGrouped = groups.length > 1;
  return (
    <div className="flex min-w-0 flex-col gap-1 p-1">
      {hasRows
        ? groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-label={group.label ?? 'Branches'}
              className="flex flex-col"
            >
              {isGrouped && group.label !== null ? (
                <div className="flex h-6 items-center gap-1 px-2 text-eyebrow text-faint-foreground">
                  <span className="truncate">{group.label}</span>
                </div>
              ) : null}
              {group.rows.map((row) => (
                <BranchSwitcherRow key={row.id} row={row} onChoose={onChoose} />
              ))}
            </div>
          ))
        : null}
      {hasRows && canCreate ? <div role="separator" className="h-px bg-border-soft" /> : null}
      {canCreate ? (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          data-menu-label="New branch"
          onClick={onNewBranch}
          className="flex h-7.5 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus:bg-hover focus:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors"
        >
          <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          New branch
        </button>
      ) : null}
    </div>
  );
};
