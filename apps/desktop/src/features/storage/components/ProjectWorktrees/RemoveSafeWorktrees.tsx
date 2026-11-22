import { useState } from 'react';
import { Trash2 } from '@goodboy/ui/icons';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../../../store';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import type { WorktreeTrack } from '../../../track/tracksOfWorkspace';

type Props = {
  readonly safe: ReadonlyArray<WorktreeTrack>;
  readonly safeBytes: number;
};

type NameParams = {
  readonly track: WorktreeTrack;
};

const folderLineOf = ({ track }: NameParams): string => {
  const { folder } = track;
  const name =
    folder.branch === '' ? (folder.path.split('/').at(-1) ?? folder.path) : folder.branch;
  return folder.sizeBytes === null ? name : `${name} ${formatBytes({ bytes: folder.sizeBytes })}`;
};

export const RemoveSafeWorktrees = ({ safe, safeBytes }: Props) => {
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  if (safe.length === 0 && !isBusy) {
    return null;
  }
  const size = formatBytes({ bytes: safeBytes });
  const label = `Remove ${safe.length} safe · ${size}`;

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({
        paths: safe.map((track) => track.folder.path),
        mode: 'safe',
      });
      setIsConfirming(false);
    } catch (error) {
      await reportError({ recovery: CHECK_STATE, title: "Couldn't remove the worktrees", error });
    } finally {
      setIsBusy(false);
    }
  };

  if (!isConfirming) {
    return (
      <Button
        size="sm"
        variant="secondary"
        intent={actionIntentOf({ verb: 'remove' })}
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 size={ICON_SIZE.row} aria-hidden />
        {label}
      </Button>
    );
  }
  const title = `Remove ${pluralize(safe.length, 'worktree')} (${size})?`;
  return (
    <div role="group" aria-label={title} className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ui text-foreground">{title}</span>
        <span className="text-meta text-muted-foreground">
          {`${safe.map((track) => folderLineOf({ track })).join(', ')}. Branches stay.`}
        </span>
      </span>
      <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setIsConfirming(false)}>
        Cancel
      </Button>
      <Button
        size="sm"
        variant="secondary"
        intent={actionIntentOf({ verb: 'remove' })}
        isBusy={isBusy}
        disabled={isBusy}
        autoFocus
        onClick={() => void onConfirm()}
      >
        Remove
      </Button>
    </div>
  );
};
