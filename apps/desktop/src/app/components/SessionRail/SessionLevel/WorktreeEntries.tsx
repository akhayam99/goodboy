import { ICON_SIZE, SelectableRow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';

import { WorktreeEntrySlot } from '../../../../features/branch/components/WorktreeEntrySlot';
import { entryAriaLabel } from '../../../../features/branch/entryAriaLabel';
import { WORKTREE_ENTRY_ICONS } from '../../../../features/branch/worktreeEntryIcons';
import { ObjectMenuArea } from '../../../../features/actions/components/ObjectMenuArea';
import type { MountActionTarget } from '../../../../features/actions/types';
import type { WorktreeCardEntry } from './worktreeCardEntriesOf';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly number: string | null;
  readonly currentTab: BranchTab | null;
  readonly entries: ReadonlyArray<WorktreeCardEntry>;
  readonly target: MountActionTarget;
};

export const WorktreeEntries = ({
  sessionId,
  target,
  worktreePath,
  branch,
  number,
  currentTab,
  entries,
}: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <nav aria-label="Worktree" className="flex flex-col">
      <ul aria-label={`${branch} pages`} data-worktree-entries="" className="flex flex-col">
        {entries.map((entry) => {
          const Icon = WORKTREE_ENTRY_ICONS[entry.tab];
          const isReference = entry.tab === 'pr' && number !== null;
          return (
            <li key={entry.tab}>
              <ObjectMenuArea target={target} anchorKey={`mount-${target.mountId}:${entry.tab}`}>
                <SelectableRow
                  selected={entry.tab === currentTab}
                  ariaCurrent={entry.tab === currentTab ? 'page' : undefined}
                  ariaLabel={entryAriaLabel({ label: entry.label, fact: entry.fact })}
                  {...(entry.fact.tooltip !== null && { title: entry.fact.tooltip })}
                  tooltipSide="right"
                  onClick={() =>
                    navigate({
                      to: branchPlace({ sessionId, mountPath: worktreePath, tab: entry.tab }),
                      mode: 'replace',
                    })
                  }
                  className="h-6 items-center gap-2 pl-7 pr-1 text-ui"
                >
                  <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  <span data-entry-label="" className="min-w-0 flex-1 truncate">
                    {entry.label}
                  </span>
                  {isReference ? (
                    <span
                      data-entry-reference=""
                      className="shrink-0 text-meta text-faint-foreground"
                    >
                      {number}
                    </span>
                  ) : null}
                  <WorktreeEntrySlot fact={entry.fact} />
                </SelectableRow>
              </ObjectMenuArea>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
