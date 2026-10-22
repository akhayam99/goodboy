import { FileText, X } from 'lucide-react';
import { Chip, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import type { StartRunFile } from '../../startRun/startRunFileOf';

type Props = {
  readonly file: StartRunFile;
  readonly isDisabled: boolean;
  readonly onRemove: () => void;
};

export const StartRunFileChip = ({ file, isDisabled, onRemove }: Props) => (
  <div role="group" aria-label={RUN_ROUTE_COPY.attached} className="flex min-w-0 items-center">
    <Chip
      tone="neutral"
      kind="reference"
      title={file.absolutePath}
      icon={<FileText size={ICON_SIZE.row} aria-hidden />}
      label={<span className="min-w-0 truncate">{file.relPath}</span>}
      trailing={
        <IconButton
          icon={X}
          size="xs"
          variant="ghost"
          label={RUN_ROUTE_COPY.removeFile({ name: file.relPath })}
          disabled={isDisabled}
          onClick={onRemove}
        />
      }
    />
  </div>
);
