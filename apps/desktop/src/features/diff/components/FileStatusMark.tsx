import type { FileDiffStatus } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD } from '../lib/fileStatus';

type Props = {
  readonly status: FileDiffStatus;
  readonly isModifiedHidden?: boolean;
};

export const FileStatusMark = ({ status, isModifiedHidden = false }: Props) => (
  <span
    aria-label={STATUS_WORD[status]}
    data-file-status={status}
    className={cn(
      'flex w-3 shrink-0 items-center justify-center text-chip',
      tintClasses(STATUS_TONE[status]).text,
    )}
  >
    {isModifiedHidden && status === 'modified' ? '' : STATUS_LETTER[status]}
  </span>
);
