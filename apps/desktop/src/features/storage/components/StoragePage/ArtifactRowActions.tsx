import { Bookmark, ChevronDown, Clock, Eye } from 'lucide-react';
import { Button, OverflowMenu, cn, tintClasses, type OverflowMenuItem } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageArtifact } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { KEEP_DAYS } from './worktreeRowMenu';

type Props = {
  readonly artifact: StorageArtifact;
  readonly isKept: boolean;
  readonly isBusy: boolean;
  readonly onDelete: () => void;
};

type AttemptParams = {
  readonly title: string;
  readonly action: () => Promise<void>;
};

const REVEAL_ON_HOVER = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

export const ArtifactRowActions = ({ artifact, isKept, isBusy, onDelete }: Props) => {
  const openStorageArtifact = useAppStore((state) => state.openStorageArtifact);
  const keepStorageArtifact = useAppStore((state) => state.keepStorageArtifact);
  const reportError = useAppStore((state) => state.reportError);

  const attempt = ({ title, action }: AttemptParams) =>
    void action().catch((error: unknown) => reportError({ title, error }));

  const keepItems: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'keep-30',
      label: `For ${KEEP_DAYS} days`,
      icon: Clock,
      onClick: () =>
        attempt({
          title: "Couldn't keep this artifact",
          action: () => keepStorageArtifact({ id: artifact.id, days: KEEP_DAYS }),
        }),
    },
    {
      kind: 'item',
      key: 'keep',
      label: 'Always',
      icon: Bookmark,
      onClick: () =>
        attempt({
          title: "Couldn't keep this artifact",
          action: () => keepStorageArtifact({ id: artifact.id, days: null }),
        }),
    },
  ];

  return (
    <span className={cn(REVEAL_ON_HOVER, 'flex items-center justify-end gap-1')}>
      <Button
        variant="ghost"
        size="sm"
        disabled={isBusy}
        onClick={() =>
          attempt({
            title: "Couldn't open this artifact",
            action: () => openStorageArtifact({ id: artifact.id }),
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
          disabled={isBusy}
          onClick={() =>
            attempt({
              title: "Couldn't update this artifact",
              action: () => keepStorageArtifact({ id: artifact.id, days: null, isStopping: true }),
            })
          }
        >
          Stop keeping
        </Button>
      ) : (
        <OverflowMenu
          items={keepItems}
          label="Keep"
          disabled={isBusy}
          triggerClassName="flex items-center gap-1 px-2 text-label"
          trigger={
            <>
              Keep
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            </>
          }
        />
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isBusy}
        onClick={onDelete}
        className={cn('text-danger hover:text-danger', tintClasses('danger').hoverBg)}
      >
        Delete
      </Button>
    </span>
  );
};
