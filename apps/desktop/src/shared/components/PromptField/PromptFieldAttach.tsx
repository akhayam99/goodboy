import { Paperclip } from '@goodboy/ui/icons';
import { IconButton } from '@goodboy/ui';
import type { PromptFieldFiles } from './index';

type Props = {
  readonly files: PromptFieldFiles;
  readonly noun: string;
  readonly isDisabled: boolean;
};

export const PromptFieldAttach = ({ files, noun, isDisabled }: Props) => (
  <>
    <IconButton
      icon={Paperclip}
      label={`Attach ${noun}`}
      {...(files.note !== undefined && { tooltip: files.note })}
      variant="ghost"
      disabled={isDisabled}
      onClick={() => files.fileInputRef.current?.click()}
    />
  </>
);
