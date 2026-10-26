import { Trash2 } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { StorageFolder } from '../../../../store/slices/storage/types';

import { formatBytes } from '../../../../shared/utils/formatBytes';

type Props = {
  readonly suggested: ReadonlyArray<StorageFolder>;
  readonly onStart: () => void;
};

export const WorktreeRemoveButton = ({ suggested, onStart }: Props) => {
  const bytes = suggested.reduce((sum, folder) => sum + (folder.sizeBytes ?? 0), 0);
  return (
    <Button variant="secondary" size="sm" onClick={onStart}>
      <Trash2 size={ICON_SIZE.row} aria-hidden />
      Remove {suggested.length} safe {suggested.length === 1 ? 'folder' : 'folders'} ·{' '}
      {formatBytes({ bytes })}
    </Button>
  );
};
