import { useState } from 'react';
import { ChevronRight, Unplug } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { StorageFolderGroup } from '../../groupStorageFolders';
import { WorktreeRow } from './WorktreeRow';
import type { ToggleFolder } from './types';

const VISIBLE_ROWS = 4;

type Props = {
  readonly group: StorageFolderGroup;
  readonly now: number;
  readonly suggestAfterDays: number;
  readonly selected: ReadonlySet<string> | null;
  readonly onToggle: ToggleFolder;
};

const RepoIcon = CONCEPT_ICONS.projectRepo;

export const WorktreeGroup = ({ group, now, suggestAfterDays, selected, onToggle }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const removing = useAppStore((state) => state.storageRemovingPaths);
  const measuringPath = useAppStore((state) => state.storageMeasuringPath);
  const visible = isOpen ? group.folders : group.folders.slice(0, VISIBLE_ROWS);
  const hidden = group.folders.length - visible.length;
  return (
    <div role="group" aria-label={group.root.projectName} className="flex flex-col">
      <div className="flex h-8 items-center gap-2 px-2 text-label font-semibold text-foreground">
        <RepoIcon size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        <span className="truncate">{group.root.projectName}</span>
        {group.root.workspaceName === null ? null : (
          <span className="truncate font-normal text-faint-foreground">
            {group.root.workspaceName}
          </span>
        )}
        {group.root.isDisconnected ? (
          <span className="inline-flex h-4.5 items-center gap-1 rounded-sm bg-muted px-1.5 text-meta font-medium text-muted-foreground">
            <Unplug size={11} aria-hidden />
            Disconnected
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-secondary font-normal tabular-nums text-muted-foreground">
          {pluralize(group.folders.length, 'folder')} · {formatBytes({ bytes: group.bytes })}
        </span>
      </div>
      {visible.map((folder) => (
        <WorktreeRow
          key={folder.path}
          folder={folder}
          now={now}
          suggestAfterDays={suggestAfterDays}
          isSelecting={selected !== null}
          isSelected={selected?.has(folder.path) ?? false}
          isRemoving={removing[folder.path] === true}
          isMeasuring={measuringPath === folder.path}
          onToggle={onToggle}
        />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground hover:bg-hover"
        >
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
          Show {hidden} more in {group.root.projectName}
        </button>
      ) : null}
    </div>
  );
};
