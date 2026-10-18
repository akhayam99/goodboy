import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { Button, Chip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { FolderGitNotice } from '../../../../shared/components/FolderGitNotice';
import { tildePath } from '../../../../shared/components/NewWorkspaceForm/tildePath';
import { homeFolder } from '../../../../shared/lib/homeFolder';
import { useAppStore } from '../../../../store';
import { inPlaceFoldersOf } from '../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { openLens } from '../../openLens';
import { folderCardCopyOf } from './folderCardCopyOf';

type Props = {
  readonly sessionId: SessionId;
};

export const FolderCard = ({ sessionId }: Props) => {
  const folders = useAppStore(useShallow((state) => inPlaceFoldersOf({ state, sessionId })));
  const purposes = useAppStore(
    useShallow((state) => folders.map((folder) => state.folderPurpose[folder.id] ?? null)),
  );
  const notices = useAppStore(
    useShallow((state) => folders.map((folder) => state.folderGitNotice[folder.id] ?? null)),
  );
  const counts = useAppStore((state) => state.sessionFolderSummary[sessionId]?.counts);
  const loadSessionFolderTurns = useAppStore((state) => state.loadSessionFolderTurns);
  const [home, setHome] = useState<string | null>(null);
  const hasFolders = folders.length > 0;

  useEffect(() => {
    if (!hasFolders) {
      return;
    }
    let isCurrent = true;
    void loadSessionFolderTurns({ sessionId });
    void homeFolder().then((found) => {
      if (isCurrent) {
        setHome(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [hasFolders, loadSessionFolderTurns, sessionId]);

  if (!hasFolders) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {folders.map((folder, index) => {
        const copy = folderCardCopyOf({ purpose: purposes[index] ?? null, counts });
        const notice = notices[index] ?? null;
        return (
          <section
            key={folder.id}
            aria-label={`${folder.name}, where agents write`}
            className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
          >
            {notice === null ? null : <FolderGitNotice project={folder} notice={notice} />}
            <div className="flex min-w-0 items-center gap-3">
              <CONCEPT_ICONS.projectFolder
                size={ICON_SIZE.hero}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-row text-foreground">{folder.name}</span>
                <span className="truncate text-code text-faint-foreground">
                  {tildePath({ path: folder.rootPath, home })}
                </span>
              </span>
              {copy.face === null ? null : (
                <Chip tone="neutral" kind="state" emphasis="subtle" label={copy.face} />
              )}
            </div>
            <dl className="grid min-w-0 grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-ui">
              <dt className="text-muted-foreground">Where agents write</dt>
              <dd className="text-foreground">In the folder itself, one session at a time</dd>
              <dt className="text-muted-foreground">Before each turn</dt>
              <dd className="text-foreground">
                Goodboy saves the files it may change, so any turn can be restored
              </dd>
              <dt className="text-muted-foreground">Changes so far</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2 text-foreground">
                <span>{copy.changes}</span>
                <Button
                  variant="quiet"
                  size="xs"
                  onClick={() => openLens({ sessionId, lens: 'files' })}
                >
                  Open Changes
                </Button>
              </dd>
              {copy.readOnly === null ? null : (
                <>
                  <dt className="text-muted-foreground">Read only</dt>
                  <dd className="text-foreground">{copy.readOnly}</dd>
                </>
              )}
            </dl>
          </section>
        );
      })}
    </div>
  );
};
