import { Code } from 'lucide-react';
import { Button, cn, tintClasses } from '@goodboy/ui';
import { useAppStore, sessionPlace } from '../../../../store';
import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RemoveIntent } from './FolderRemoveConfirm';

type Props = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly isBusy: boolean;
  readonly onRemove: (intent: RemoveIntent) => void;
  readonly onEditor: () => void;
};

const REVEAL_ON_HOVER = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

export const RowPrimaryAction = ({ folder, status, isBusy, onRemove, onEditor }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  if (status === 'safe' && folder.origin !== 'in-use') {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isBusy}
        onClick={() => onRemove('safe')}
        className={cn(
          'text-danger hover:text-danger',
          REVEAL_ON_HOVER,
          tintClasses('danger').hoverBg,
        )}
      >
        Remove
      </Button>
    );
  }
  if (status === 'dirty' || status === 'operation') {
    return (
      <Button variant="secondary" size="sm" onClick={onEditor}>
        <Code size={ICON_SIZE.row} aria-hidden />
        Open in editor
      </Button>
    );
  }
  const sessionId = folder.sessionId;
  const hasLiveSession =
    sessionId !== null && folder.why !== 'deleted-session' && folder.why !== 'no-session';
  if (status === 'writing' && hasLiveSession) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: sessionPlace({ sessionId }) })}
      >
        Open session
      </Button>
    );
  }
  return null;
};
