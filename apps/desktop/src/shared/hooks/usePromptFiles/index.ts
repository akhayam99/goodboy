import { useState } from 'react';
import type { PromptFieldFiles } from '../../components/PromptField';
import { usePendingAttachments, type AttachmentDropNotices } from '../usePendingAttachments';

type Params = {
  readonly note: string;
  readonly isEnabled?: boolean;
  readonly notices?: AttachmentDropNotices;
};

const DROP_NOTICES: AttachmentDropNotices = {
  ambiguous: 'Drop the file on the box you are writing in to attach it.',
  disabled: 'Files cannot be attached here right now.',
  unavailable: 'File drop is unavailable. Use Attach files instead.',
};

export const usePromptFiles = ({ note, isEnabled = true, notices = DROP_NOTICES }: Params) => {
  const [notice, setNotice] = useState<string | null>(null);
  const pending = usePendingAttachments({
    showToast: ({ message }) => {
      if (message === notices.unavailable) {
        return;
      }
      setNotice(message);
    },
    enabled: isEnabled,
    notices,
  });

  const files: PromptFieldFiles = {
    attachments: pending.attachments,
    isDragging: pending.isDragging,
    composerRef: pending.composerRef,
    fileInputRef: pending.fileInputRef,
    onPaste: pending.onPaste,
    onFileInputChange: pending.onFileInputChange,
    onRemove: (id) => {
      setNotice(null);
      pending.removeAttachment(id);
    },
    note,
  };

  const clear = () => {
    setNotice(null);
    pending.setAttachments([]);
  };

  return {
    files,
    notice,
    attachments: pending.attachments,
    setAttachments: pending.setAttachments,
    clear,
  };
};
