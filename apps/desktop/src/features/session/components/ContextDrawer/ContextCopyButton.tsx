import { CopyButton, ICON_SIZE } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly brief: string;
};

export const ContextCopyButton = ({ brief }: Props) =>
  brief === '' ? null : (
    <CopyButton
      presentation="icon"
      value={brief}
      label={NAMES.copyContext}
      size={ICON_SIZE.row}
      className="size-7 justify-center p-0"
    />
  );
