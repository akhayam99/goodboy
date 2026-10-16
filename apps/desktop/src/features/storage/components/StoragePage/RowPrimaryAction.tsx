import { Code } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { useAppStore, sessionPlace } from '../../../../store';
import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly onEditor: () => void;
};

export const RowPrimaryAction = ({ folder, status, onEditor }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
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
