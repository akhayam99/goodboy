import { formatBytes } from '../../shared/utils/formatBytes';

type Params = {
  readonly totalBytes: number;
  readonly workspaceName: string | null;
  readonly isAllScope: boolean;
  readonly freeBytes: number | null;
};

const LOW_DISK_BYTES = 10 * 1024 ** 3;

export const storageMetaOf = ({
  totalBytes,
  workspaceName,
  isAllScope,
  freeBytes,
}: Params): string => {
  const place = isAllScope ? 'on this Mac' : `in ${workspaceName ?? 'this workspace'}`;
  const total = `${formatBytes({ bytes: totalBytes })} ${place}`;
  if (freeBytes === null || freeBytes >= LOW_DISK_BYTES) {
    return total;
  }
  return `${total} · Low space: ${formatBytes({ bytes: freeBytes })} free on this disk`;
};
