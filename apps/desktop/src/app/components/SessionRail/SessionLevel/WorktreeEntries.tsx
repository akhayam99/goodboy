import { SelectableRow } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WorktreeEntrySlot } from '../../../../features/branch/components/WorktreeEntrySlot';
import { entryAriaLabel } from '../../../../features/branch/entryAriaLabel';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import { WORKTREE_ENTRY_ICONS } from '../../../../features/branch/worktreeEntryIcons';
import type { WorktreeCardEntry } from './worktreeCardEntriesOf';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly entries: ReadonlyArray<WorktreeCardEntry>;
};

export const WorktreeEntries = ({ sessionId, mountId, worktreePath, branch, entries }: Props) => (
  <ul aria-label={`${branch} pages`} data-worktree-entries="" className="flex flex-col">
    {entries.map((entry) => {
      const Icon = WORKTREE_ENTRY_ICONS[entry.tab];
      return (
        <li key={entry.tab}>
          <SelectableRow
            selected={false}
            ariaLabel={entryAriaLabel({ label: entry.label, fact: entry.fact })}
            {...(entry.fact.tooltip !== null && { title: entry.fact.tooltip })}
            tooltipSide="right"
            onClick={() =>
              void switchBranchMount({
                sessionId,
                mountId,
                worktreePath,
                mode: 'push',
                tab: entry.tab,
              })
            }
            className="h-6 items-center gap-2 pl-9 pr-1 text-ui"
          >
            <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span data-entry-label="" className="min-w-0 flex-1 truncate">
              {entry.label}
            </span>
            <WorktreeEntrySlot fact={entry.fact} />
          </SelectableRow>
        </li>
      );
    })}
  </ul>
);
