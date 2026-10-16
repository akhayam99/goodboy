import type { ChangeEvent, RefObject } from 'react';
import { Paperclip } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly worktree: string | null;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const ATTACH_TOOLTIP = 'Attach files. Their paths go in the pack for the agent to read.';

const NO_WORKTREE_TOOLTIP = 'This session has no worktree yet, so nothing can be attached.';

export const ArtifactAttachButton = ({ worktree, fileInputRef, onFileInputChange }: Props) => (
  <>
    <IconButton
      icon={Paperclip}
      label="Attach files"
      tooltip={worktree === null ? NO_WORKTREE_TOOLTIP : ATTACH_TOOLTIP}
      variant="ghost"
      iconSize={ICON_SIZE.control}
      disabled={worktree === null}
      onClick={() => fileInputRef.current?.click()}
    />
    <input
      ref={fileInputRef}
      type="file"
      accept={ATTACHMENT_ACCEPT}
      multiple
      hidden
      aria-label="Choose files to attach"
      data-testid="artifact-attachments-input"
      onChange={onFileInputChange}
    />
  </>
);
