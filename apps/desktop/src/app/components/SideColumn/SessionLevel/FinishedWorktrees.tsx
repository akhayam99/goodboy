import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SelectableRow } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WorktreeRow } from './WorktreeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly projectName: string;
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
  readonly shownPath: string | null;
};

export const FinishedWorktrees = ({ sessionId, projectName, rows, statuses, shownPath }: Props) => {
  const isShownInside = rows.some(
    (row) => row.worktreePath !== null && row.worktreePath === shownPath,
  );
  const [isOpen, setIsOpen] = useState(isShownInside);
  if (rows.length === 0) {
    return null;
  }
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <li className="flex flex-col">
      <SelectableRow
        selected={false}
        isExpanded={isOpen}
        ariaLabel={`${rows.length} finished in ${projectName}`}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className="h-7 items-center gap-2 px-2 text-label"
      >
        <Chevron size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{`${rows.length} finished`}</span>
      </SelectableRow>
      {isOpen ? (
        <ul aria-label={`${projectName} finished worktrees`} className="flex flex-col">
          {rows.map((row) => (
            <li key={row.mountId}>
              <WorktreeRow
                sessionId={sessionId}
                row={row}
                status={row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null)}
                isShown={row.worktreePath !== null && row.worktreePath === shownPath}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
};
