import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Band, BandRow, SectionHeader, formatError } from '@goodboy/ui';
import type { StorageScope } from '../../../../store/slices/storage/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { SavedVersionsMeter } from '../../../../shared/components/SavedVersionsMeter';
import { storageOwnerMatchesScope } from '../../storageOwnerMatchesScope';

type Props = {
  readonly scope: StorageScope;
};

const FolderIcon = CONCEPT_ICONS.projectFolder;
const HistoryIcon = CONCEPT_ICONS.storage;

export const SavedVersionsSection = ({ scope }: Props) => {
  const folders = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.kind === 'folder' &&
          project.disconnectedAt === undefined &&
          storageOwnerMatchesScope({ ownerWorkspace: project.workspaceId, scope }),
      ),
    ),
  );
  const sizes = useAppStore(
    useShallow((state) => folders.map((folder) => state.folderHistorySizes[folder.id] ?? null)),
  );
  const loadFolderHistorySize = useAppStore((state) => state.loadFolderHistorySize);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    for (const folder of folders) {
      void loadFolderHistorySize({ folder }).catch((cause: unknown) =>
        setError(formatError(cause)),
      );
    }
  }, [folders, loadFolderHistorySize]);

  if (folders.length === 0) {
    return null;
  }
  const totalBytes = sizes.reduce((total, size) => total + (size?.usedBytes ?? 0), 0);
  return (
    <section
      id="storage-saved-versions"
      aria-label="Saved versions"
      className="flex flex-col gap-2"
    >
      <SectionHeader
        label={`Saved versions · ${formatBytes({ bytes: totalBytes })}`}
        icon={<HistoryIcon size={ICON_SIZE.row} aria-hidden />}
      />
      <Band>
        {folders.map((folder, index) => {
          const size = sizes[index] ?? null;
          return (
            <BandRow key={folder.id}>
              <FolderIcon
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-row text-foreground">{folder.name}</span>
                <span className="truncate text-meta text-faint-foreground">
                  {size === null
                    ? 'Reading the size'
                    : `${pluralize(size.versionCount, 'version')}, kept until 30 days after each session ends`}
                </span>
              </span>
              {size === null ? null : (
                <>
                  <SavedVersionsMeter folderName={folder.name} size={size} className="w-24" />
                  <span className="w-32 shrink-0 text-right text-meta tabular-nums text-muted-foreground">
                    {formatBytes({ bytes: size.usedBytes })} of{' '}
                    {formatBytes({ bytes: size.capBytes })}
                  </span>
                </>
              )}
            </BandRow>
          );
        })}
      </Band>
      {error === null ? null : (
        <p role="alert" className="text-label text-danger">
          Couldn't read the size of saved versions: {error}
        </p>
      )}
    </section>
  );
};
