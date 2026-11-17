import { Bookmark, ChevronDown, Clock, Eye } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, OverflowMenu, type MenuEntry } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import type { StorageArtifact } from '../../../../store/slices/storage/types';
import { openStorageArtifact } from '../../openStorageArtifact';

import { KEEP_DAYS } from '../../../actions/kinds/worktree';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';

type Props = {
  readonly artifact: StorageArtifact;
  readonly isKept: boolean;
  readonly isBusy: boolean;
  readonly onDelete: () => void;
};

const OPEN_KEY = 'open';
const KEEP_KEY = 'keep';

type AttemptParams = {
  readonly key: typeof OPEN_KEY | typeof KEEP_KEY;
  readonly title: string;
  readonly action: () => Promise<void>;
};

export const ArtifactRowActions = ({ artifact, isKept, isBusy, onDelete }: Props) => {
  const markStorageArtifactOpened = useAppStore((state) => state.markStorageArtifactOpened);
  const keepStorageArtifact = useAppStore((state) => state.keepStorageArtifact);
  const { pendingKeys, run } = usePendingAction();
  const isRowBusy = isBusy || pendingKeys.size > 0;

  const attempt = ({ key, title, action }: AttemptParams) =>
    void run({ key, failureTitle: title, task: action });

  const keepEntries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'keep-30',
      label: `For ${KEEP_DAYS} days`,
      icon: Clock,
      onSelect: () =>
        attempt({
          key: KEEP_KEY,
          title: "Couldn't keep this artifact",
          action: () => keepStorageArtifact({ id: artifact.id, days: KEEP_DAYS }),
        }),
    },
    {
      kind: 'item',
      key: 'keep',
      label: 'Always',
      icon: Bookmark,
      onSelect: () =>
        attempt({
          key: KEEP_KEY,
          title: "Couldn't keep this artifact",
          action: () => keepStorageArtifact({ id: artifact.id, days: null }),
        }),
    },
  ];

  return (
    <span className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={isRowBusy}
        isBusy={pendingKeys.has(OPEN_KEY)}
        onClick={() =>
          attempt({
            key: OPEN_KEY,
            title: "Couldn't open this artifact",
            action: async () => {
              await openStorageArtifact({ artifact });
              await markStorageArtifactOpened({ id: artifact.id });
            },
          })
        }
      >
        <Eye size={ICON_SIZE.row} aria-hidden />
        Open
      </Button>
      {isKept ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={isRowBusy}
          isBusy={pendingKeys.has(KEEP_KEY)}
          onClick={() =>
            attempt({
              key: KEEP_KEY,
              title: "Couldn't update this artifact",
              action: () => keepStorageArtifact({ id: artifact.id, days: null, isStopping: true }),
            })
          }
        >
          Stop keeping
        </Button>
      ) : (
        <OverflowMenu
          entries={keepEntries}
          label="Keep"
          disabled={isRowBusy}
          triggerClassName="flex items-center gap-1 px-2 text-meta"
          trigger={
            <>
              Keep
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            </>
          }
        />
      )}
      <Button
        {...actionButtonLookOf({ verb: 'artifact.delete', variant: 'ghost' })}
        size="sm"
        disabled={isRowBusy}
        onClick={onDelete}
      >
        Delete
      </Button>
    </span>
  );
};
