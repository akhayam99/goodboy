import type { GoalAttachmentOwner } from '@goodboy/types';

type Params = {
  readonly owner: GoalAttachmentOwner;
};

export const attachmentReadKey = ({ owner }: Params): string => `${owner.type}:${owner.id}`;
