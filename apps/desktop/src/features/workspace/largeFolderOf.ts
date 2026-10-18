import type { FolderSignals } from '@goodboy/types';
import { formatBytes } from '../../shared/utils/formatBytes';
import { dominantMediaOf } from './dominantMediaOf';

const LARGE_FOLDER_BYTES = 2 * 1024 * 1024 * 1024;

type Params = {
  readonly signals: FolderSignals;
};

type LargeFolder = {
  readonly size: string;
  readonly media: string | null;
};

export const largeFolderOf = ({ signals }: Params): LargeFolder | null => {
  if (signals.totalBytes <= LARGE_FOLDER_BYTES) {
    return null;
  }
  const size = formatBytes({ bytes: signals.totalBytes });
  return {
    size: signals.isTruncated ? `over ${size}` : size,
    media: dominantMediaOf({ signals }),
  };
};
