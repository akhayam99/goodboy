import { Meter } from '@goodboy/ui';
import type { FolderHistorySize } from '../../features/file-versions/folderHistorySize';

type Props = {
  readonly folderName: string;
  readonly size: FolderHistorySize;
  readonly className?: string;
};

export const SavedVersionsMeter = ({ folderName, size, className }: Props) => (
  <Meter
    label={`Saved versions of ${folderName}`}
    value={size.usedBytes}
    max={size.capBytes}
    className={className}
  />
);
