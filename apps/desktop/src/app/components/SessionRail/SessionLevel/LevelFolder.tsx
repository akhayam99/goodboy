import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@goodboy/types';
import { cn, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { inPlaceFoldersOf } from '../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { LevelCard } from './LevelCard';
import { folderFaceLineOf } from './folderFaceLineOf';
import { CARD_ROW_INSET } from './railInset';
import { useLevelCardFold } from './useLevelCardFold';

type Props = {
  readonly session: Session;
};

const LABEL_ID = 'level-folder-label';

export const LevelFolder = ({ session }: Props) => {
  const sessionId = session.id;
  const folders = useAppStore(useShallow((state) => inPlaceFoldersOf({ state, sessionId })));
  const purposes = useAppStore(
    useShallow((state) => folders.map((folder) => state.folderPurpose[folder.id] ?? null)),
  );
  const loadSessionFolderTurns = useAppStore((state) => state.loadSessionFolderTurns);
  const fold = useLevelCardFold({ card: 'folder' });
  const hasFolders = folders.length > 0;

  useEffect(() => {
    if (!hasFolders) {
      return;
    }
    void loadSessionFolderTurns({ sessionId });
  }, [hasFolders, loadSessionFolderTurns, sessionId]);

  if (!hasFolders) {
    return null;
  }

  return (
    <LevelCard
      id={LABEL_ID}
      label={folders.length === 1 ? 'Folder' : 'Folders'}
      isOpen={fold.isOpen}
      onToggle={fold.toggle}
    >
      <ul className="flex min-w-0 flex-col">
        {folders.map((folder, index) => (
          <li key={folder.id} className={cn('flex min-w-0 items-start gap-2 py-1', CARD_ROW_INSET)}>
            <span className="flex h-5 shrink-0 items-center text-muted-foreground">
              <CONCEPT_ICONS.projectFolder size={ICON_SIZE.control} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ui text-foreground">{folder.name}</span>
              <span className="truncate text-meta text-muted-foreground">
                {folderFaceLineOf({ purpose: purposes[index] ?? null })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </LevelCard>
  );
};
