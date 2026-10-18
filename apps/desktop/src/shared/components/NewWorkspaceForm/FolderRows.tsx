import { Info, Lock, Plus } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import { FolderRow } from './FolderRow';
import { tildePath } from './tildePath';
import type { WorkspaceDraft } from './useWorkspaceDraft';

type Props = {
  readonly draft: WorkspaceDraft;
  readonly home: string | null;
  readonly destinationName: string;
  readonly isBusy: boolean;
};

const FoundIcon = CONCEPT_ICONS.explore;

export const FolderRows = ({ draft, home, destinationName, isBusy }: Props) => {
  const isMulti = draft.folders.length > 1;
  const only = draft.folders.length === 1 ? draft.folders[0] : undefined;
  const snappedFrom = only?.kind === 'repository' ? only.snappedFrom : null;
  const repositoryCount = draft.found?.repositoryCount ?? 0;
  const repositories = repositoryCount === 1 ? '1 repository' : `${repositoryCount} repositories`;
  return (
    <div className="flex flex-col gap-2">
      {draft.found === null ? null : (
        <p className="flex items-center gap-1 text-label text-muted-foreground">
          <FoundIcon size={ICON_SIZE.row} aria-hidden className="text-primary" />
          Found {repositories} in {draft.found.parentName}.
        </p>
      )}
      {snappedFrom === null || only === undefined ? null : (
        <p className="flex items-center gap-1 text-label text-muted-foreground">
          <Info size={ICON_SIZE.row} aria-hidden className="text-primary" />
          {tildePath({ path: snappedFrom, home })} is inside {only.name}, so the workspace uses the
          whole repository.
        </p>
      )}
      <ul
        aria-label="Folders"
        className="flex flex-col gap-0.5 overflow-hidden rounded-lg ring-1 ring-border-soft"
      >
        {draft.folders.map((folder) => (
          <FolderRow
            key={folder.path}
            folder={folder}
            draft={draft}
            home={home}
            destinationName={destinationName}
            isMulti={isMulti}
            isBusy={isBusy}
          />
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={isBusy}
          isBusy={draft.readingPath !== null}
          busyLabel="Reading folder"
          onClick={() => void draft.addFolder()}
        >
          <Plus size={ICON_SIZE.row} strokeWidth={2} aria-hidden />
          Add folder
        </Button>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-meta text-faint-foreground">
          <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="truncate">
            Agents work on their own branch. Nothing is pushed until you ask.
          </span>
        </span>
      </div>
    </div>
  );
};
