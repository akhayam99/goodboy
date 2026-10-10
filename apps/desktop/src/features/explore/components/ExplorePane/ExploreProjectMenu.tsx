import type { CrumbMenuGroup, CrumbMenuRow } from '@goodboy/ui';
import { BranchSwitcherRow } from '../../../branch/components/BranchHeader/BranchSwitcherRow';

type Props = {
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly onChoose: (row: CrumbMenuRow) => void;
};

export const ExploreProjectMenu = ({ groups, onChoose }: Props) => (
  <div className="flex min-w-0 flex-col gap-1 p-1">
    {groups.map((group) => (
      <div
        key={group.id}
        role="group"
        aria-label={group.label ?? 'Projects'}
        className="flex flex-col"
      >
        {group.label === null ? null : (
          <div className="flex h-6 items-center gap-1 px-2 text-eyebrow text-faint-foreground">
            <span className="truncate">{group.label}</span>
          </div>
        )}
        {group.rows.map((row) => (
          <BranchSwitcherRow key={row.id} row={row} onChoose={onChoose} />
        ))}
      </div>
    ))}
  </div>
);
