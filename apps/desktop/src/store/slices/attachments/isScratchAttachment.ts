import { SCRATCH_ATTACHMENT_PREFIX } from './scratchAttachmentPrefix';

type Params = {
  readonly relPath: string;
};

export const isScratchAttachment = ({ relPath }: Params): boolean =>
  relPath.startsWith(`.goodboy/attachments/${SCRATCH_ATTACHMENT_PREFIX}`);
